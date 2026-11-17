import type { enCycles } from "../en/cycles";

export const trCycles: Record<keyof typeof enCycles, string> = {
  cycles_empty_title: "Henüz döngü yok",
  cycles_empty_body:
    "Ajan her uyandığında buraya bir döngü kaydeder — hiçbir şey yapmamaya karar verdikleri dahil.",
  cycles_judged: "{count} değerlendirildi",
  cycles_blocked: "{count} engellendi",

  cycle_status_ok: "tamam",
  cycle_status_skipped: "atlandı",
  cycle_status_error: "hata",
  cycle_status_running: "çalışıyor",

  cycles_page_title: "Döngüler",
  cycles_page_body:
    "Ajanın uyandığı her an için bir satır — hiçbir şey yapmamaya karar verdiği döngüler ve nedenleri dahil.",

  cycles_crumb_portfolio: "Portföy",
  cycles_crumb_agent: "Ajan {id}",
  cycles_crumb_cycles: "Döngüler",
  cycles_crumb_cycle: "Döngü",
  cycles_crumb_cycle_n: "Döngü #{seq}",
  cycles_trace_title: "Ajan ne yaptı",
  cycles_trace_body:
    "Her koltuk, konuştuğu sırayla — sonradan derlenmiş değil, ajan harekete geçmeden önce yazılmış. Her satır kayda geçmiş bir şeyi yeniden ifade eder; herhangi bir koltuğun kaydını açıp aynen görebilirsiniz.",
  cycles_record: "Kayıt",
  cycles_hide_record: "Kaydı gizle",
  cycles_recorded_verbatim: "Aynen kaydedildi",
  cycles_data_from: "Veri kaynağı: {sources}",
};
