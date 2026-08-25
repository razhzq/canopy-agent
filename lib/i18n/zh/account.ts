import type { enAccount } from "../en/account";

export const zhAccount: Record<keyof typeof enAccount, string> = {
  gate_eyebrow: "内测阶段",
  gate_unreachable_title: "无法确认访问权限",
  gate_unreachable_body:
    "我们无法连接 Canopy 来核对您的访问权限。这不代表您的账户被拒绝 — 只是这次核对没有完成。",
  gate_locked_title: "需要邀请码",
  gate_locked_body:
    "Canopy Agent 目前处于内测阶段。您的账户已登录 — 只是还不在名单上。输入您收到的邀请码即可解锁。",
  gate_code_label: "邀请码",
  gate_code_placeholder: "CANOPY-XXXX-XXXX",
  gate_checking: "校验中…",
  gate_unlock: "解锁访问",
  gate_sign_out: "退出登录",
  gate_session_expired: "您的登录状态已过期，请重新登录。",
  gate_code_rejected: "该邀请码未能解锁访问权限。",

  username_title: "设置用户名",
  username_body: "它会在 Canopy 各处取代您的邮箱显示，别人也通过它找到您。",
  username_placeholder: "yourname",
  username_available: "@{name} 可以使用。",
  username_checking: "检查中…",
  username_min_length: "至少 3 个字符。",
  username_charset: "仅限字母、数字和下划线。",
  username_taken: "该名称已被占用。",
  username_later: "稍后再说",
  username_claim: "确认使用",
  username_saving: "保存中…",
  username_note: "用户名在整个 Canopy 内唯一，并与交易所共用。",
};
