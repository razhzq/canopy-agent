import type { enActivity } from "../en/activity";

export const trActivity: Record<keyof typeof enActivity, string> = {
  activity_empty_title: "Henüz bir şey yok",
  activity_empty_body:
    "İlk döngü, ajan oluşturulduğu anda başlar ve birkaç saniye içinde burada görünür — ajan alacak bir şey bulsa da bulmasa da çalışır. Sonrasında saatte bir uyanır.",
  activity_checking: "15 saniyede bir kontrol ediliyor",
  activity_signed_out_note: "Bu ajanı görmek için giriş yapın.",

  activity_reveal_progress: "{total} içinden {shown}",
  activity_still_running: "hâlâ çalışıyor",
  activity_hide_notes: "Tarama notlarını gizle",
  activity_notes_one: "1 tarama notu",
  activity_notes_many: "{count} tarama notu",

  activity_status_running: "Çalışıyor",
  activity_status_ok: "Tamamlandı",
  activity_status_error: "Başarısız",
  activity_status_skipped: "Atlandı",

  activity_headline_running: "Şimdi çalışıyor…",
  activity_headline_failed: "Döngü başarısız",
  activity_headline_skipped: "Atlandı",
  activity_headline_closed_and_opened: "{closed} kapandı, {opened} açıldı",
  activity_headline_closed_one: "1 pozisyon kapandı",
  activity_headline_closed_many: "{count} pozisyon kapandı",
  activity_headline_fills_one: "1 gerçekleşme",
  activity_headline_fills_many: "{count} gerçekleşme",
  activity_headline_approved: "risk kapısından {count} tanesi geçti",
  activity_headline_blocked: "risk kapısı {count} tanesini engelledi",
  activity_headline_nothing: "Evren tarandı, hiçbir öneri çıkmadı",

  feed_empty_title: "Henüz bir şey yok",
  feed_empty_no_agents:
    "Bir ajan devreye alın; çalıştırdığı her döngü burada görünsün — hiçbir şey yapmamaya karar verdikleri dahil.",
  feed_empty_no_cycles:
    "Ajanlarınız henüz bir döngü tamamlamadı. İlki, uyanır uyanmaz burada görünecek.",
  feed_empty_action: "Ajan oluştur",
  feed_filter_all: "Tümü",
  feed_filter_traded: "İşlem yapılan",
  feed_filter_quiet: "Sessiz",
  feed_none_traded: "Bu aralıkta işlem yapan döngü yok.",
  feed_all_traded: "Bu aralıktaki her döngü işlem yaptı.",
  feed_badge_paper: "Kağıt",
  feed_footer_one:
    "{total} içinden {shown} · sahibi olduğunuz 1 ajandan son {per} döngü",
  feed_footer_many:
    "{total} içinden {shown} · sahibi olduğunuz {agents} ajandan son {per} döngü",
  feed_footer_partial_one: " · 1 ajanın kaydı yüklenemedi",
  feed_footer_partial_many: " · {count} ajanın kaydı yüklenemedi",

  skip_market_closed: "Piyasalar kapalıydı",
  skip_no_candidates: "Taramayı geçen olmadı",
  skip_budget_exhausted: "Model bütçesi bitti",
  skip_model_balance_exhausted: "Model bakiyesi bitti",
  skip_model_unfunded: "Fonlanmayı bekliyor",
  skip_model_unavailable: "Model kullanılamıyor",
  skip_paused: "Ajan duraklatıldı",
  skip_expired: "Yetki süresi doldu",
  skip_not_active: "Ajan etkin değil",
};
