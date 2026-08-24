import type { enSettings } from "../en/settings";

export const zhSettings: Record<keyof typeof enSettings, string> = {
  billing_section: "套餐",
  billing_note: "已用 {used} / {slots} 个智能体 · {live} 个实盘",
  billing_paper_agents: "模拟盘智能体",
  billing_paper_note_earned: "{base} 个免费 + {earned} 个通过邀请获得",
  billing_paper_note_base: "{base} 个免费 · 邀请他人可获得更多",
  billing_live_agents: "实盘智能体",
  billing_live_each: "每个 {amount}/月",
  billing_live_total: "合计 {amount}/月",

  billing_invite_title: "邀请一个人，多得一个智能体",
  billing_invite_body:
    "每有一个人通过您的邀请码加入，您的额度就永久增加一个模拟盘智能体。没有上限。",
  billing_invite_yours: "您的邀请码是 {code} — 在右上角的账户菜单里也能找到。",

  billing_over_title: "智能体数量超出额度",
  billing_over_body:
    "这些智能体是在额度限制生效之前部署的，会继续运行。在回到 {slots} 个以内之前，您无法再创建新的智能体。",

  billing_failed_title: "操作未能完成",
  billing_none_found_title: "仍未找到订阅记录",
  billing_none_found_body:
    "如果您刚刚完成付款，可能需要一点时间才会同步过来。请一分钟后再查一次 — 如果仍然显示这条提示，说明付款没有成功。",

  billing_agent_number: "智能体 #{id}",
  billing_live_until: "实盘运行至 {date} — 到期后暂停",
  billing_renews: "{amount}/月 · {date} 续费",
  billing_cancel: "取消订阅",
  billing_date_unknown: "未知",

  billing_paper_default:
    "所有智能体默认以模拟盘运行 — 同样的标的池、同样的council评议、同样的决策记录。转为实盘为每个智能体 {amount}/月，从该智能体自己的页面开始。",
  billing_live_price: "实盘为每个智能体 {amount}/月。请从该智能体的页面开始。",
  billing_recheck: "我已付款 — 重新检查",
  billing_checking: "检查中…",
  billing_ending_title: "将在本计费周期结束时终止",
  billing_ending_body:
    "这些智能体在此之前会继续实盘交易。周期结束时它们会带着持仓暂停 — 不会替您卖出任何东西。",
  billing_session_expired: "登录状态已过期，请重新登录。",

  tg_section: "TELEGRAM",
  tg_state_connected: "已连接",
  tg_state_muted: "已静音",
  tg_state_not_connected: "未连接",
  tg_signed_out_note: "通知设置属于您的账户。",
  tg_unavailable_title: "此环境暂不支持",
  tg_unavailable_body: "该部署没有配置 Telegram 机器人，目前没有可连接的对象。",

  tg_will_send_title: "您会收到什么",
  tg_will_send_1: "— 智能体的每一笔交易，以及它赚了还是亏了多少。",
  tg_will_send_2: "— 任何等待您决定的事项。",
  tg_will_send_3: "— 触发回撤上限，以及智能体自行停止。",
  tg_will_send_4: "— 因价格无法读取而冻结交易，以及冻结解除。",

  tg_wont_send_title: "您不会收到什么",
  tg_wont_send_body:
    "那些智能体看过之后什么都没做的普通周期。这类周期占了大多数 — 大约四分之三 — 全部推送会把上面那些真正重要的消息淹没。这里的安静意味着智能体在正常工作，而不是卡住了。",

  tg_approving_title: "在 Telegram 里审批",
  tg_approving_body:
    "刻意不支持。Telegram 识别的是一个聊天会话，而不是一个人 — 如果回复就能授权交易，那么一部未锁屏的手机就等同于交易权限。方案的审批只能在 Canopy 里、在您的登录状态下完成。",

  tg_connected: "已连接",
  tg_connected_as: "已连接 · @{username}",
  tg_delivering: "提醒正在推送到这个聊天。",
  tg_muted_body: "已静音。连接仍然保留，但不会推送任何内容。",
  tg_mute: "静音",
  tg_unmute: "取消静音",
  tg_reconnect: "重新连接",
  tg_disconnect: "断开连接",
  tg_opening: "正在打开 Telegram…",
  tg_connect: "连接 Telegram",
  tg_mute_vs_disconnect:
    "静音会保留连接但停止推送。断开连接会彻底忘记这个聊天 — 重新连接需要一条新的链接。如果您没有静音却收不到消息，请用“重新连接”：它会签发一个新的验证码，并在新聊天确认之前保留现有连接。",
  tg_connect_help:
    "这会打开与 Canopy 机器人的聊天，并附带一个一次性验证码。发送它预填的那条消息，然后回到本页刷新 — 连接是在 Telegram 里完成的，本页只能在下一次查看时才知道。",
};
