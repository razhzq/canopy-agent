import type { enCycles } from "../en/cycles";

export const zhCycles: Record<keyof typeof enCycles, string> = {
  cycles_empty_title: "还没有任何周期",
  cycles_empty_body:
    "智能体每次被唤醒都会在这里留下一条周期记录 — 包括那些它决定什么都不做的周期。",
  cycles_judged: "已裁定 {count} 项",
  cycles_blocked: "拦截 {count} 项",

  cycle_status_ok: "正常",
  cycle_status_skipped: "已跳过",
  cycle_status_error: "出错",
  cycle_status_running: "运行中",

  cycles_page_title: "周期",
  cycles_page_body: "智能体每唤醒一次就是一行 — 包括那些它决定什么都不做的周期，以及原因。",

  cycles_crumb_portfolio: "投资组合",
  cycles_crumb_agent: "智能体 {id}",
  cycles_crumb_cycles: "周期",
  cycles_crumb_cycle: "周期",
  cycles_crumb_cycle_n: "第 {seq} 周期",
  cycles_trace_title: "智能体做了什么",
  cycles_trace_body:
    "按发言顺序列出每个席位，内容在智能体行动之前就已写入，而非事后回溯拼凑。每一行都只是复述已经被记录下来的内容 — 展开任一席位的记录即可看到原始数据。",
  cycles_record: "原始记录",
  cycles_hide_record: "收起记录",
  cycles_recorded_verbatim: "原样记录",
  cycles_data_from: "数据来自 {sources}",
};
