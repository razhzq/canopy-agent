import type { enWorkspace } from "../en/workspace";

export const trWorkspace: Record<keyof typeof enWorkspace, string> = {
  my_empty_title: "Henüz ajan yok",
  my_empty_body:
    "Bir tane oluşturun; kağıt modunda, canlı veriyle çalışmaya başlasın — ücretsiz, süre sınırı yok ve hiçbir şey fonlanmadan.",
  my_empty_action: "Ajan oluştur",

  my_band_paper_capital: "Kağıt sermaye",
  my_band_capital_deployed: "Kullanımdaki sermaye",
  my_band_across_one: "1 ajan genelinde",
  my_band_across_many: "{count} ajan genelinde",
  my_band_pnl: "K/Z · devreye alındığından beri",
  my_band_no_readings: "henüz ölçüm yok",
  my_band_live: "Canlı",
  my_band_paper: "Kağıt",
  my_band_needs_you: "Sizi bekliyor",
  my_band_unanswered: "yanıtlanmamış",
  my_band_nothing_waiting: "bekleyen yok",

  my_stopped_itself:
    "{name} kendini durdurdu — {when}, {reason}. Limitleri gözden geçirin ya da devam ettirin.",
  my_review: "Gözden geçir",

  reason_max_drawdown: "düşüş limitini aştığı için",
  reason_wallet_revoked: "cüzdan yetkisi iptal edildiği için",
  reason_wallet_expired: "cüzdan yetkisinin süresi dolduğu için",
  reason_mandate_expired: "yetki süresi dolduğu için",
  reason_insufficient_funds: "bakiyesi tükendiği için",
  reason_model_balance_exhausted: "model bakiyesi tükendiği için",

  my_col_agent: "Ajan",
  my_col_wallet: "Cüzdan",
  my_col_status: "Durum",
  my_col_capital: "Sermaye",
  my_col_return: "Getiri",
  my_col_last_ran: "Son çalışma",
  my_row_paper_suffix: " · kağıt",
  my_row_copied: "kopyalandı",
  my_row_unfunded: "fonlanmadı",
  my_retry: "Tekrar dene",
  my_retry_title: "Özkaynak ölçümü yüklenemedi. Rakam, ajanın kendi sayfasında.",
  my_no_data: "veri yok",
  my_no_data_title: "Henüz hiçbir döngü özkaynak ölçümü kaydetmedi.",
  my_resume: "Devam ettir",
  my_pause: "Duraklat",
  my_busy: "…",
  my_edit_limits: "Limitleri düzenle",
  my_detail: "Ayrıntı",
  my_footnote:
    "Ajanınızın kuralları sizindir — kâr al, zarar durdur, neyi işlem yapacağı, hepsi — ve değişiklik zaten çalışan ajana, bir sonraki döngüsünden itibaren uygulanır. Bu, ajanın sohbetinde olur; “limitleri düzenle” de oraya gider.",

  agent_status_active: "Canlı",
  agent_status_paused: "Duraklatıldı",
  agent_status_liquidating: "Pozisyonlar kapatılıyor",
  agent_status_stopped: "Durduruldu",
  agent_status_draft: "Taslak",
};
