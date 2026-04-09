export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { apiKey, r105, r409 } = req.body;
    if (!apiKey || !r105 || !r409) return res.status(400).json({ error: "Eksik parametre" });

    const SYSTEM_PROMPT = `Sen TOBB uzmaninin asistanisin. Iki raporu analiz edip transfer talimati uret.
R105=stok raporu, R409=satis raporu.
KURAL: Kullanim Tipi=STOK olanlari yok say. Her Ulke+BelgeTipi+KullanimTipi kombinasyonu ayri hesaplansin. Hedef: tum burolarin ayni belgeyi ayni zamanda bitirmesi. Belgeler 2026 icin. Transfer asamasindaki belgeler alici buronun stokuna eklensin. R409 satisi 0 olan burolar icin uyari ekle.
HESAPLAMA: aylik_satis/30=gunluk_satis. toplam_stok/toplam_gunluk_satis=hedef_gun. hedef_gun*buronun_gunluk_satis=hedef_stok. Fazlasi gonderici, eksigi alici.
SADECE JSON DON, BASKA HIC BIR SEY YAZMA:
{"ozet":{"toplam_belge_turu":0,"toplam_transfer_adeti":0,"kritik_uyarilar":[]},"transfer_talimatlari":[{"ulke":"","belge_tipi":"","kullanim_tipi":"","transferler":[{"gonderen":"","alici":"","adet":0,"aciklama":""}],"transfer_sonrasi_durum":[{"buro":"","mevcut_stok":0,"yeni_stok":0,"aylik_satis":0,"tahmini_tukenme_gun":0}]}]}`;

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
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: r105 }, title: "R105" },
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: r409 }, title: "R409" },
            { type: "text", text: "Analiz et. Sadece JSON don." }
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
