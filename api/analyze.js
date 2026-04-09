export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { apiKey, r105, r409 } = req.body;
    if (!apiKey || !r105 || !r409) return res.status(400).json({ error: "Eksik parametre" });

    const SYSTEM_PROMPT = `Sen TOBB'da geçiş belgesi biriminde çalışan bir uzmanın asistanısın. Görevin, sana verilen iki raporu analiz ederek dağıtım büroları arasında belge transfer talimatları üretmek.

RAPORLAR:
- R105 (Belge Durum Raporu): Hangi dağıtım bürosunda hangi belgeden kaç adet stok var
- R409 (Belge Satış İstatistik Raporu): Geçen ay hangi büro hangi belgeden kaç adet satmış

TEMEL KURALLAR:
1. "Kullanım Tipi" = "STOK" olan satırları tamamen yok say, hesaplamaya dahil etme.
2. Her (Ülke + Belge Tipi + Kullanım Tipi) kombinasyonunu birbirinden bağımsız olarak ayrı ayrı hesapla ve ayrı transfer talimatı üret.
3. Hedef: Tüm büroların aynı kombinasyondaki belgeyi yaklaşık aynı zamanda bitirmesi (eşit tükenme tarihi).
4. Belgeler 2026 yılı boyunca kullanılacak, perspektif 1 yıl.
5. R105'in ikinci sayfasında "Transfer Aşamasındaki Belgeler" bölümü varsa, oradaki belgeleri ilgili ALICI büronun mevcut stokuna ekle.
6. R409'da hiç satışı görünmeyen ama R105'te stoğu olan bürolar için: stoğu en fazla satış yapan büroya transfer et ve kritik uyarı ekle.
7. Minimum transfer miktarı yoktur, 1 adet bile olsa transfer talimatı ver.

HESAPLAMA YÖNTEMİ (her kombinasyon için ayrı ayrı):
- Her büronun günlük satış hızı = R409'daki aylık satış / 30
- Toplam günlük satış hızı = tüm büroların günlük satış hızlarının toplamı
- Hedef tükenme günü = toplam stok / toplam günlük satış hızı
- Her büronun hedef stoğu = hedef tükenme günü × büronun günlük satış hızı
- Hedef stoktan FAZLA stoğu olan bürolar = gönderici
- Hedef stoktan EKSİK stoğu olan bürolar = alıcı
- Transfer miktarı = büronun mevcut stoğu - büronun hedef stoğu (fazla için pozitif, eksi için negatif)

ÖNEMLİ: R409'da görünen HER büro ve HER kombinasyon için mutlaka hesaplama yap. Hiçbir kombinasyonu atlama. Sonuçta kaç farklı Ülke+BelgeTipi+KullanimTipi kombinasyonu varsa o kadar transfer_talimatlari elemanı olmalı.

ÇIKTI FORMATI - Sadece ve sadece geçerli JSON döndür, başka hiçbir şey yazma, markdown veya açıklama ekleme:
{
  "ozet": {
    "toplam_belge_turu": <kac farkli kombinasyon varsa>,
    "toplam_transfer_adeti": <tum transferlerdeki adet toplamı>,
    "kritik_uyarilar": ["<uyarı metni>"]
  },
  "transfer_talimatlari": [
    {
      "ulke": "<ülke adı>",
      "belge_tipi": "<belge tipi>",
      "kullanim_tipi": "<kullanım tipi>",
      "transferler": [
        {
          "gonderen": "<büro adı>",
          "alici": "<büro adı>",
          "adet": <sayı>,
          "aciklama": "<kısa açıklama>"
        }
      ],
      "transfer_sonrasi_durum": [
        {
          "buro": "<büro adı>",
          "mevcut_stok": <transfer öncesi stok>,
          "yeni_stok": <transfer sonrası stok>,
          "aylik_satis": <R409'daki aylık satış>,
          "tahmini_tukenme_gun": <yeni stok / günlük satış hızı, 0 ise 0>
        }
      ]
    }
  ]
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: r105 }, title: "R105 Belge Durum Raporu" },
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: r409 }, title: "R409 Belge Satis Istatistik Raporu" },
            { type: "text", text: "Bu iki raporu analiz et. R409'daki her kombinasyon için ayrı hesaplama yap. Sadece JSON döndür, başka hiçbir şey yazma." }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
