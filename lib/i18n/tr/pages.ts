import type { enPages } from "../en/pages";

export const trPages: Record<keyof typeof enPages, string> = {
  page_title_root: "Canopy Ajan Platformu",
  page_desc_root:
    "Bir stratejiyi kendi ajanınız olarak devreye alın. Varlıklar sizde kalır. Her limiti siz belirlersiniz.",

  page_title_settings: "Ayarlar · Canopy",
  page_title_wallet_audit: "Cüzdan denetimi · Canopy",
  page_title_activity: "Hareketler · Canopy",
  page_title_portfolio: "Portföy · Canopy",
  page_title_notifications: "Bildirimler · Canopy",
  page_title_agents: "Ajanlar · Canopy",
  page_title_atlas: "Atlas · Canopy",
  page_title_workspace: "Ajanlarım · Canopy",

  page_eyebrow_portfolio: "Portföy",
  page_eyebrow_account: "Hesap",

  settings_title: "Ayarlar",
  settings_body: "Ajanlarınız ve Canopy'nin size nasıl ulaşacağı.",

  activity_page_title: "Hareketler",
  activity_page_body:
    "Ajanlarınızın çalıştırdığı her döngü — baktıkları ama hiçbir şey yapmadıkları döngüler dahil.",

  workspace_page_title: "Ajanlarım",
  workspace_page_body:
    "Devreye aldığınız her şey — ne tuttuğu, nasıl gittiği ve hangisinin sizi beklediği.",

  notifications_page_title: "Bildirimler",
  notifications_page_body: "Ajanlarınız ne yaptı ve sizden ne bekliyor.",

  crash_title: "Bu sayfada bir şey bozuldu",
  crash_body:
    "Sayfa, arkasında duramayacağı rakamları göstermek yerine durdu. Yeniden denemek genellikle yeterli olur.",
  crash_retry: "Yeniden dene",
  crash_home: "Ajanlarım",
  crash_reset: "Kayıtlı taslakları temizle ve yeniden dene",
  crash_reset_note:
    "Bu tarayıcıda kayıtlı yarım kalmış bir taslak buna yol açmış olabilir. Temizlemek yalnızca o taslağı siler — ajan, bakiye ve ayarlar etkilenmez.",
  crash_ref: "Referans {digest}",
};
