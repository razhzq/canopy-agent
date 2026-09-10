import type { enPositions } from "../en/positions";

export const trPositions: Record<keyof typeof enPositions, string> = {
  positions_tab_open: "Açık",
  positions_tab_open_count: "Açık · {count}",
  positions_tab_history: "Geçmiş",

  positions_empty:
    "Açık pozisyon yok. Giriş kuralı sağlanana kadar ajan nakitte bekler.",

  positions_col_asset: "Varlık",
  positions_col_qty: "Adet",
  positions_col_cost: "Maliyet",
  positions_at_price: "@ {price}",
  positions_col_value: "Değer",
  positions_col_pnl: "K/Z",
  positions_pnl_net_title:
    "Kapatma maliyeti olan {cost} düşüldükten sonra. Pozisyonun kendisi {gross}.",
  positions_since: "{date} tarihinden beri",
  positions_entries_since: "{count} giriş · {date} tarihinden beri",
  positions_not_priced: "fiyatlanamadı",
  positions_close_aria: "{symbol} pozisyonunu kapat",
  positions_close_title: "Bu pozisyonu kapat",
  positions_entries: "Girişler",

  positions_history_empty:
    "Henüz gerçekleşen işlem yok. Her döngü aşağıdaki hareket kaydında yine de tutulur.",
  positions_col_side: "Yön",
  positions_col_realised: "Gerçekleşen",
  positions_side_buy: "Alış",
  positions_side_sell: "Satış",
  positions_badge_paper: "Kağıt",
  positions_fill_cycle: "{date} · döngü {cycle}",
  positions_load_more: "Daha fazla yükle",
  positions_loading: "Yükleniyor…",
  positions_sign_in_more: "Daha fazlası için giriş yapın.",
  positions_count_one_partial: "şimdiye kadar 1 işlem",
  positions_count_many_partial: "şimdiye kadar {count} işlem",
  positions_count_one_all: "1 işlem — hepsi bu",
  positions_count_many_all: "{count} işlem — hepsi",

  positions_open_showing: "{total} içinden {shown} gösteriliyor",
  positions_open_count_one: "1 pozisyon",
  positions_open_count_many: "{count} pozisyon",
};
