import type { enEquity } from "../en/equity";

export const trEquity: Record<keyof typeof enEquity, string> = {
  equity_unavailable_title: "Performans görüntülenemiyor",
  equity_unavailable_body:
    "Özkaynak ölçümleri yüklenemedi. Bu sayfadaki diğer her şey güncel — tekrar denemek için sayfayı yenileyin.",
  equity_no_curve_title: "Henüz eğri yok",
  equity_no_curve_body:
    "Eğri, tamamlanan her döngü için bir nokta çizer. İlki, ajan bir kez çalışır çalışmaz görünür.",
  equity_paper_equity: "Kağıt özkaynak",
  equity_equity: "Özkaynak",
  equity_against_capital: "{pnl} · {capital} sermayeye karşı {pct}",
  equity_realised: "Gerçekleşen",
  equity_unrealised: "Gerçekleşmemiş",
  equity_max_drawdown: "Azami düşüş",
  equity_hit_rate: "İsabet oranı",
  equity_deployed: "Kullanımda",
  equity_cycle_n: "Döngü {seq}",
  equity_readout_head: "Döngü {seq} · {when}",
  equity_readout_pnl: "{pnl} · {pct}",
  equity_readout_cash: "{amount} nakit",

  close_title: "{symbol} kapatılsın mı?",
  close_subtitle: "Pozisyonun tamamı, şimdi piyasadan satılır.",
  close_size: "Büyüklük",
  close_selling: "Satılıyor",
  close_checking_wallet: "Cüzdan kontrol ediliyor",
  close_wallet_matches: "Cüzdan bakiyesi doğrulandı",
  close_wallet_short: "Cüzdanda {held} var; defterde {book} kayıtlı",
  close_wallet_short_note:
    "Satılacak olan, cüzdanda bulunandır; aşağıdaki rakamlar da o miktara aittir.",
  close_wallet_empty: "Cüzdanda hiç {symbol} yok",
  close_wallet_empty_note:
    "Satılacak bir şey yok. Elle dışarı aktarıldıysa, pozisyon bunun yerine defterden silinebilir.",
  close_avg_cost: "Ortalama maliyet",
  close_price_now: "Şu anki fiyat",
  close_total_value: "Toplam değer",
  close_pnl: "K/Z",
  close_fee: "Kapatma maliyeti",
  close_pnl_net: "Masraf sonrası K/Z",
  close_not_priced: "fiyatlanamadı",
  close_unpriced_note:
    "Bu varlığın şu anda okunabilir bir fiyatı yok. Satış, tahmini bir fiyattan gerçekleştirilmek yerine reddedilecek — birkaç dakika sonra tekrar deneyin.",
  close_note:
    "Ajan çalışmaya ve diğer pozisyonlarını tutmaya devam eder. Giriş kuralı yeniden sağlanırsa bunu tekrar alabilir.",
  close_keep: "Hayır, kalsın",
  close_confirm: "Evet, kapat",
  close_closing: "Kapatılıyor…",
  close_sold: "Zincir üzerinde satıldı",
  close_sold_body: "Pozisyon kapatıldı ve gelir USDC olarak ajanın cüzdanına döndü.",
  close_done: "Tamam",
  close_sign_in: "Bu pozisyonu kapatmak için giriş yapın.",
};
