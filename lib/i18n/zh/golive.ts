import type { enGoLive } from "../en/golive";

export const zhGoLive: Record<keyof typeof enGoLive, string> = {
  gl_steps_aria: "转实盘的步骤",
  gl_step_subscribe: "订阅",
  gl_step_subscribe_purpose: "实盘执行按智能体逐个计费",
  gl_step_delegate: "授权",
  gl_step_delegate_purpose: "授予智能体签名权限",
  gl_step_golive: "转实盘",
  gl_step_golive_purpose: "将智能体切换到真实资金",

  gl_eyebrow: "{name} · 模拟盘",
  gl_title: "切换到实盘",
  gl_title_done: "实盘运行中",

  gl_checking_title: "正在查询该智能体的订阅状态…",
  gl_checking_body: "请稍候，这样接下来问您的才是正确的问题。",

  gl_waiting_title: "我们还没有看到这笔付款",
  gl_waiting_body:
    "BoomFi 通常会在一分钟左右告知我们新的订阅，在此之前这个对话框不会做出相反的判断。等待期间不会有任何损失 — 智能体仍在照常以模拟盘运行。",
  gl_sub_title: "实盘执行需要订阅",
  gl_sub_body:
    "让这个智能体使用真实资金运行的费用是 {price}，只针对这一个智能体收取。模拟盘交易始终免费，在订阅生效之前这个智能体不会有任何变化。",
  gl_sub_price_unknown: "按月订阅",
  gl_sub_price: "{amount}/月",
  gl_checking: "查询中…",
  gl_check_again: "重新查询",
  gl_opening: "正在打开…",
  gl_subscribe: "订阅",
  gl_not_now: "暂不订阅",
  gl_assurance_abandoned:
    "如果您关闭了 BoomFi 而没有付款，请关掉这里并重新点击「实盘」重新开始。目前没有产生任何扣费。",
  gl_assurance_checkout:
    "您会在 BoomFi 完成付款，然后直接回到这个智能体，本对话框会从授权那一步继续。在此期间它会继续以模拟盘运行。",

  gl_grant_title: "授予该智能体签名权限",
  gl_grant_body:
    "授权发生在您自己的钱包里，而不是 Canopy 的服务器上 — 这正是钱包始终属于您的原因。授权范围仅限兑换交易，可动用的资金不会超过您在这个钱包里存入的部分，并且您随时可以自行撤销，无需经过我们。",
  gl_grant_assurance: "授权不等于转账。在智能体于该范围内执行交易之前，您的钱包不会有任何资金流出。",

  gl_promote_title: "切换到真实资金",
  gl_promote_body: "该智能体会保留它的规则、历史，以及它在模拟盘上学到的一切。",
  gl_promote_body_open_one:
    "该智能体会保留它的规则、历史，以及它在模拟盘上学到的一切 — 但它当前 1 笔模拟持仓会先按真实价格结算，因此实盘账本从空仓开始。",
  gl_promote_body_open_many:
    "该智能体会保留它的规则、历史，以及它在模拟盘上学到的一切 — 但它当前 {count} 笔模拟持仓会先按真实价格结算，因此实盘账本从空仓开始。",
  gl_row_wallet: "钱包",
  gl_row_scope: "授权范围",
  gl_scope_swaps: "仅限兑换交易",
  gl_row_expires: "授权到期",
  gl_deposit_assurance:
    "您可以在此之前或之后存入资金。空钱包不会造成任何损失 — 智能体只会等待，并明确告诉您它在等待，直到 USDC 到账。可以从本页顶部的钱包栏充值。",
  gl_confirm_warning:
    "从下一个周期开始，该智能体将使用真实资金交易 — 即这个钱包里的全部余额 — 并停止模拟盘交易。您随时可以暂停它。它的模拟盘记录不会丢失 — 账本、周期和对话仍可从开关的「模拟盘」一侧查看 — 但智能体本身无法退回模拟盘。",
  gl_settling: "结算中…",
  gl_confirm: "是的，使用真实资金交易",
  gl_back: "返回",
  gl_go_live: "转为实盘",

  gl_promoted_title: "{name} 已开始使用真实资金交易",
  gl_promoted_body:
    "从下一个周期起，成交都是真实的。模拟盘账本原样保留，仍可从开关的「模拟盘」一侧查看 — 它积累的记录一点都没有丢。",
  gl_done: "完成",

  gd_grant: "授予签名权限",
  gd_preparing: "正在准备该智能体的钱包…",
  gd_granting: "请在您的钱包中确认…",
  gd_registering: "正在记录…",
  gd_active: "授权已生效",
  gd_active_custodial: "授权已生效 — 托管钱包",
  gd_custodial_body: "这个钱包由 Canopy 持有，而不是您本人。结束授权需要经过 Canopy。",
  gd_self_custody_body: "这个钱包属于您。您随时可以在钱包设置中结束这项授权，无需经过 Canopy。",
  gd_misconfigured:
    "该部署尚未配置委托授权。请运行 pnpm provision:privy 并设置签名者与策略 id。",
  gd_err_not_configured: "委托授权未配置 — 缺少签名者和策略 id",
  gd_err_session: "您的登录状态已过期 — 请重新登录后再试",
  gd_err_no_wallet_id: "授权已完成，但 Privy 没有返回钱包 id — 未登记任何内容",
};
