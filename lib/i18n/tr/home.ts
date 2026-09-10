import type { enHome } from "../en/home";

export const trHome: Record<keyof typeof enHome, string> = {
  home_balance_window_one: "24S · 1 AJAN GENELİNDE",
  home_balance_window_many: "24S · {count} AJAN GENELİNDE",
  home_top_performers: "En iyi performans",
  home_chip_all: "Tümü",
  home_chip_top: "En yüksek K/Z",
  home_chip_new: "Yeni",
  home_chip_held: "En çok kullanılan",
  home_empty_title: "Henüz listelenen yok",
  home_empty_body:
    "Yayımlanan stratejiler canlı bir sicille burada görünür. Bir tane oluşturun; kağıt üzerinde, canlı veriyle çalışmaya başlasın.",
  home_empty_action: "Ajan oluştur",
  home_row_deployed: "{count} kez devrede",
  home_row_deployed_win: "{count} kez devrede · %{pct} isabet",
  home_badge_paper: "kağıt",

  capability_asked_shipped:
    "{example} istemiştiniz. Yapıldı, artık kullanabilirsiniz.",
  capability_asked_existing:
    "{example} istemiştiniz. Meğer ajan bunu zaten yapabiliyormuş.",
  capability_set_up_under: "{key} altından ayarlayın.",
  capability_dismiss: "Kapat",

  model_badge_title: "{label} ile akıl yürütüyor — Canopy'de barındırılan Qwen3",
  model_badge_title_pod: "{label} ile akıl yürütüyor — Pod üzerinden satın alındı",
  model_badge_credit: "{amount} $ ön ödemeli bakiye kaldı",
};
