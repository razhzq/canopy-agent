import type { enSettings } from "../en/settings";

export const trSettings: Record<keyof typeof enSettings, string> = {
  billing_section: "Ajanlar",
  billing_note: "{slots} içinden {used} · {live} canlı",
  billing_paper_agents: "Kağıt ajanlar",
  billing_paper_note_earned: "{base} ücretsiz + davetlerden {earned}",
  billing_paper_note_base: "{base} ücretsiz",
  billing_live_agents: "Canlı ajanlar",
  billing_live_each: "her biri {amount}/ay",
  billing_live_total: "toplam {amount}/ay",

  billing_invite_line:
    "Katılan her davet bir kağıt ajan ekler. Kodunuz: {code}.",
  billing_invite_line_nocode: "Katılan her davet bir kağıt ajan ekler.",

  billing_over_title: "Hakkınızın üzerindesiniz",
  billing_over_body:
    "Bunlar çalışmaya devam eder. {slots} altına indiğinizde yenisini oluşturabilirsiniz.",

  billing_failed_title: "Bu işlem geçmedi",
  billing_none_found_title: "Henüz abonelik yok",
  billing_none_found_body:
    "Ödemelerin bize ulaşması bir dakika sürer. Birazdan tekrar bakın.",

  billing_agent_number: "Ajan #{id}",
  billing_live_until: "{date} tarihine kadar canlı, sonra duraklatılır",
  billing_renews: "{amount}/ay · {date} tarihinde yenilenir",
  billing_cancel: "İptal et",
  billing_date_unknown: "bilinmiyor",

  billing_live_price:
    "Canlı mod ajan başına {amount}/ay; ajanın kendi sayfasından başlatılır.",
  billing_recheck: "Ödemeyi kontrol et",
  billing_checking: "Kontrol ediliyor…",
  billing_ending_title: "Bu dönem sonunda bitiyor",
  billing_ending_body:
    "O zamana kadar canlı işlem yaparlar, sonra pozisyonlarını tutarak duraklarlar.",
  billing_session_expired: "Oturum süresi doldu. Tekrar giriş yapın.",

  tg_section: "Telegram",
  tg_state_connected: "bağlı",
  tg_state_muted: "sessize alındı",
  tg_state_not_connected: "bağlı değil",
  tg_signed_out_note: "Bildirim ayarları hesabınıza aittir.",
  tg_unavailable_title: "Burada kullanılamıyor",
  tg_unavailable_body: "Bu kurulumda Telegram botu yok.",

  tg_will_send_title: "Şunları alırsınız",
  tg_will_send_1: "Her işlem, sonucuyla birlikte.",
  tg_will_send_2: "Kararınızı bekleyen her şey.",
  tg_will_send_3: "Durdurmalar ve donmalar, bir de kalktıkları an.",
  tg_wont_line: "Sessiz döngüler gelmez. Onaylar Canopy'de kalır.",

  tg_connected: "Bağlandı",
  tg_connected_as: "@{username}",
  tg_not_connected_body: "Ajanlarınızla ilgili uyarılar, bir sohbette.",
  tg_delivering: "İletiliyor",
  tg_muted_body: "Sessize alındı",
  tg_delivery_aria: "İletim",
  tg_toggle_delivering: "İletiliyor",
  tg_toggle_muted: "Sessiz",
  tg_connect: "Telegram'ı bağla",
  tg_opening: "Telegram açılıyor…",
  tg_waiting: "Telegram bekleniyor",
  tg_waiting_help:
    "Telegram'ın açtığı mesajı gönderin. Bu sayfa kendiliğinden güncellenir.",
  tg_open_again: "Telegram'ı tekrar aç",
  tg_reconnect: "Yeniden bağlan",
  tg_reconnect_title:
    "Yeni bir kod üretir. Yeni sohbet onaylanana kadar bu bağlantı geçerli kalır.",
  tg_disconnect: "Bağlantıyı kes",
  tg_disconnect_title: "Bu sohbeti unut. Yeniden bağlanmak için yeni kod gerekir.",
};
