import type { enEarnings } from "../en/earnings";

export const trEarnings: Record<keyof typeof enEarnings, string> = {
  ce_title: "Üretici kazançları",
  ce_intro:
    "Bir Canopy ajanı bir cüzdanın likidite pozisyonlarını kopyalayıp kârla kapattığında, bu kârın bir kısmı kopyalanan cüzdan için ayrılır. O cüzdan sizinse, buradan alırsınız.",
  ce_loading: "Kazançlarınız yükleniyor",
  ce_empty_title: "Henüz kazanç yok",
  ce_empty_body:
    "Bir Solana cüzdanı bağlayıp onun için ayrılmış bir şey olup olmadığına bakın. Bağlamak Canopy ile hiçbir şey paylaşmaz.",
  ce_verified: "Doğrulandı",
  ce_available: "Alınabilir",
  ce_pending: "Bekleyen",
  ce_lifetime: "Toplam",
  ce_copiers: "Kopyalayan",
  ce_pending_note:
    "Alınabilir tutar Canopy'de durur ve şimdi ödenebilir. Bekleyen tutar tahakkuk etti ama hâlâ kopyalayan ajanın cüzdanında; Canopy tahsil edene kadar alınamaz.",
  ce_claim: "Ödeme talep et",
  ce_claiming: "Talep ediliyor…",
  ce_claim_min: "Ödemeler {min} tutarından başlar.",
  ce_claim_open: "{amount} tutarındaki ödeme {status}.",
  ce_status_requested: "inceleme bekliyor",
  ce_status_approved: "onaylandı, gönderiliyor",
  ce_status_paying: "gönderiliyor",
  ce_status_paid: "ödendi",
  ce_status_rejected: "reddedildi",
  ce_status_failed: "başarısız",
  ce_unverified: "Bağlı, doğrulanmadı",
  ce_unverified_body:
    "Cüzdanı kontrol ettiğinizi kanıtlamak için kısa bir mesaj imzalayın. Hiçbir varlık transfer etmez, hiçbir işlemi onaylamaz.",
  ce_verify: "Cüzdanı doğrula",
  ce_verifying: "İmza bekleniyor…",
  ce_connect: "Başka bir cüzdan",
  ce_connect_body:
    "Kazançlar kopyalanan cüzdana aittir; bu genellikle Canopy cüzdanı değil, Phantom veya Backpack'te tuttuğunuz bir cüzdandır.",
  ce_connect_action: "Cüzdan bağla",
  ce_err_no_wallet: "O cüzdan artık bağlı değil. Yeniden bağlayıp deneyin.",
  ce_err_signed_out: "Oturumunuz sona erdi. Tekrar giriş yapın.",
};
