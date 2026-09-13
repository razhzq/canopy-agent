import type { enStrategy } from "../en/strategy";

export const zhStrategy: Record<keyof typeof enStrategy, string> = {
  rule_marketCapUsd: "最小市值",
  rule_marketCapUsd_help:
    "代币本身的价值 — 流通量乘以当前价格。与流动性下限不是一回事：市值一百万的代币，池子里可能只有五万。把它设为两段式入场的「观察」条件，即「市值到一百万后，等回调再买」。仅限代币 — 代币化股票没有市值，永远无法满足这一条。",
  rule_marketCapUsdMax: "最大市值",
  rule_marketCapUsdMax_help:
    "同一个数字的另一端 — 不超过这个值。两者都设就是在一个市值区间里挑标的。仅限代币。",
  rule_liquidityUsd: "最低流动性",
  rule_liquidityUsd_help: "Solana 上的池子深度。适用于所有标的，黄金也不例外。",
  rule_dailyVolPct: "最大日波动率",
  rule_dailyVolPct_help: "标的的历史已实现波动率，数据来自 Wintel。",
  rule_maxEventScore: "最高近期事件严重度",
  rule_maxEventScore_help: "跳过本周出现过严重异常活动事件的标的。",
  rule_netMarginPct: "最低净利率",
  rule_netMarginPct_help: "来自 SEC 财报，适用于股票；大宗商品会跳过此项。",
  rule_changePct: "当日最大涨跌幅",
  rule_changePct_help: "只在下跌后买入。−4 表示今天必须已经跌了 4% 或更多。",
  rule_momentum20dPct: "最低动量",
  rule_momentum20dPct_help:
    "最近 20 根 K 线的百分比变化。大于 0 要求它已经上涨；负值则买入弱势。这是唯一跟随您所选周期的涨跌幅规则。",
  rule_rsi14: "最大 RSI",
  rule_rsi14_help:
    "通常认为 70 以上为超买 — 调低它可以避免追高。该指标与周期无关：在任何 K 线级别上，70 的含义都一样。",
  rule_smaSpreadPct: "最低趋势强度",
  rule_smaSpreadPct_help: "20 与 50 周期均线之间的差距。大于 0 表示短均线在上 — 处于上升趋势。",
  rule_belowHigh60dPct: "距高点最小回落",
  rule_belowHigh60dPct_help: "必须低于 60 周期高点多少。大于 0 表示买回调而不是买突破。",
  rule_macdHistPct: "最低 MACD 柱",
  rule_macdHistPct_help:
    "MACD（12/26/9），以价格百分比衡量，因此同一套设置在黄金和股票上都适用。大于 0 表示金叉已经发生。",
  rule_atrPct: "最大 ATR",
  rule_atrPct_help:
    "14 根 K 线的平均真实波幅，以价格百分比表示 — 也就是该代币在一根 K 线内通常的波动幅度，含跳空。调低只会放行更平稳的代币。",
  rule_rsi14Min: "最低 RSI",
  rule_rsi14Min_help:
    "同一个读数，方向相反：必须「至少」达到这个值。高于 50 就是买强势而不是买弱势 — 作为卖出信号时，70 表示「涨得过头就平掉」。",
  rule_bollingerBandwidthPctMin: "最小布林带宽",
  rule_bollingerBandwidthPctMin_help:
    "要求布林带至少有这么「宽」。这正是「下轨买、中轨卖」策略需要的规则：在中轨卖出赚到的是一个标准差，也就是这个数字的四分之一 — 带宽 4% 意味着这一笔只值 1%，而 10% 的止损是回报的六倍。把它设到止损的三倍以上，两者才算匹配。",
  rule_bollingerPctB: "最大布林 %B",
  rule_bollingerPctB_help:
    "价格在 20 周期布林带中的位置：0 是下轨，50 是中轨，100 是上轨。调低它就是在区间底部附近买入。",
  rule_bollingerBandwidthPct: "最大布林带宽",
  rule_bollingerBandwidthPct_help: "布林带的宽度，以价格百分比表示。调低它只在波动收敛时交易。",
  rule_supertrendDistancePct: "最小 Supertrend 距离",
  rule_supertrendDistancePct_help:
    "价格高出 Supertrend 轨道多少，以百分比表示。大于 0 表示 Supertrend 当前看多，并在整段趋势中持续成立 — 设为 0 即“只在上升趋势中买入”。若要捕捉翻转本身，请用下面那条规则。",
  rule_supertrendFlipUpBars: "Supertrend 向上翻转于",
  rule_supertrendFlipUpBars_help:
    "Supertrend 转为看多是在几根 K 线之前。0 表示就在最新一根，3 表示在最近三根之内。这是一个“事件” — 一次新鲜信号 — 所以大多数代币在大多数时候都会被跳过，这正是趋势跟踪的本意。",
  rule_supertrendFlipDownBars: "Supertrend 向下翻转于",
  rule_supertrendFlipDownBars_help:
    "Supertrend 转为看空是在几根 K 线之前。很少作为入场条件 — 适合刻意买入弱势的策略。",

  rule_window_daily: "{label}（{periods} 日）",
  rule_window_bars: "{label}（{periods} × {timeframe}）",
  rule_basis_change:
    "始终按 24 小时计算 — 这一条不跟随策略周期。若想按您所选的 K 线级别衡量涨跌幅，请用下面的「最低动量」。",
  rule_basis_daily: "始终按日计算 — 这一条不跟随策略周期。",
  rule_span_minutes: "≈ {n} 分钟",
  rule_span_hours: "≈ {n} 小时",
  rule_span_hours_minutes: "≈ {h} 小时 {m} 分",
  rule_span_days: "≈ {n} 天",
  rule_at_least: "至少",
  rule_at_most: "至多",

  tf_1d: "1 日",
  tf_1d_detail: "默认值。每个指标背后约有 120 天的历史数据。",
  tf_1h: "1 小时",
  tf_1h_detail: "两个月的历史数据。14 周期 RSI 覆盖约两天。",
  tf_30m: "30 分钟",
  tf_30m_detail: "六周的历史数据。仅限代币化资产 — 代币池不提供这个级别的 K 线。",
  tf_15m: "15 分钟",
  tf_15m_detail: "一个月的历史数据。14 周期 RSI 覆盖约 3 个半小时。",
  tf_5m: "5 分钟",
  tf_5m_detail: "一个月的历史数据。足以支撑日内波段。",
  tf_1m: "1 分钟",
  tf_1m_detail: "两小时的历史数据。仅限加密资产 —— RWA 数据源不提供分钟级 K 线。",

  cad_1m: "1 分钟",
  cad_1m_detail: "调度器的最快频率。建议搭配带排序的筛选使用。",
  cad_5m: "5 分钟",
  cad_5m_detail: "止损最灵敏。每天约 288 次模型调用。",
  cad_15m: "15 分钟",
  cad_15m_detail: "能在盘中做出反应。每天约 96 次。",
  cad_30m: "30 分钟",
  cad_30m_detail: "每天约 48 次。",
  cad_1h: "1 小时",
  cad_1h_detail: "默认值。每天约 24 次。",
  cad_4h: "4 小时",
  cad_4h_detail: "较为安静。每天约 6 次。",
  cad_1d: "1 日",
  cad_1d_detail: "每天运行一个周期。",

  tpl_quality: "优质标的定投",
  tpl_quality_body: "流动性好、盈利稳健、波动小。买入平淡的，跳过躁动的。默认模板。",
  tpl_quality_meta: "最保守",
  tpl_averse: "规避事件",
  tpl_averse_body: "同样的思路，但更严格：更深的流动性、更平静的盘面，并排除本周出现异常的标的。",
  tpl_averse_meta: "交易最少",
  tpl_opportunistic: "机会主义",
  tpl_opportunistic_body: "容忍更高波动和更弱的利润率，以看到更多候选标的。方案会更多，被否决的也会更多。",
  tpl_opportunistic_meta: "最活跃",

  src_fundamentals: "基本面",
  src_fundamentals_detail: "利润率、财报、资产负债表",
  src_news: "新闻与事件",
  src_news_detail: "异常活动、财报检索",
  src_technical: "技术面",
  src_technical_detail: "RSI、趋势、距高点距离 — 按日",
  src_sentiment: "市场情绪",
  src_sentiment_detail: "X 与社交媒体",
  src_smart_money: "聪明钱",
  src_smart_money_detail: "钱包资金流向",

  bs_starting_point: "起点模板",
  bs_starting_note: "每一个都可以直接运行。",
  bs_custom: "自定义",
  bs_template_meta: "· {meta}",
  bs_adjusted: "已在模板基础上调整。选择上方任一模板可从一套已知配置重新开始。",
  bs_entry_rules: "入场规则",
  bs_entry_note: "买入之前必须成立的条件。",
  bs_tune: "调整",
  bs_done: "完成",
  bs_exit_rules: "出场规则",
  bs_exit_note: "只有入场规则的话，它会一直买入却从不卖出。",
  bs_take_profit: "止盈",
  bs_take_profit_help: "持仓上涨到这个幅度时平仓。",
  bs_stop_loss: "止损",
  bs_stop_loss_help: "持仓下跌到这个幅度时平仓。填的是幅度 — 12 表示下跌 12%。",
  bs_time_limit: "持有时限",
  bs_time_limit_help: "超过这段时间后，无论价格如何都平仓。",
  bs_time_never: "不限",
  bs_days: "{n} 天",
  bs_minutes: "{n} 分钟",
  bs_time_limit_mins: "时间限制（分钟）",
  bs_time_limit_mins_help: "达到该分钟数后无论价格如何都平仓。与天数限制同时设置时，以较早者为准。",
  bs_exits_note:
    "出场规则在每个周期都会先于寻找新标的被检查 — 包括那些什么都没买的周期。价格无法读取的持仓绝不会按猜测的价格平掉。",
  bs_basket_title: "整体出场",
  bs_basket_body: "当整个持仓组合达到某个水平时,一次性平掉所有仓位 — 而不是按每个仓位各自的水平。",
  bs_basket_on: "开启",
  bs_basket_off: "关闭",
  bs_basket_take: "组合止盈",
  bs_basket_take_help: "当整体持仓组合的浮盈达到这个百分比时,平掉所有仓位,不论各个仓位表现如何。",
  bs_basket_stop: "组合止损",
  bs_basket_stop_help: "当整体持仓组合的浮亏达到这个百分比时,平掉所有仓位。",
  bs_timeframe: "K 线周期",
  bs_timeframe_note: "上面每条规则所依据的 K 线级别。",
  bs_timeframe_help:
    "这会改变规则的含义，而不只是运行频率。RSI 14 在日线上覆盖两周的抛售，在 15 分钟线上只覆盖约三小时 — 上方的标签会随之更新。无论您在这里选什么，波动率、当日涨跌幅和事件严重度都仍按日计算。",
  bs_cycle: "运行周期",
  bs_cycle_note: "它多久唤醒一次 — 不是 K 线周期。",
  bs_cadence_matched: "与您的 K 线周期一致 — 每个周期恰好有一根新 K 线。",
  bs_cadence_faster:
    "比您的 K 线周期更快：有些周期会重复读取尚未变化的同一根 K 线，并为得到同样的结论再付一次模型调用。它换来的是更紧的止损，因为出场规则每个周期都会检查。",
  bs_cadence_slower:
    "比您的 K 线周期更慢：智能体会跳过一些从未看到的 K 线。如果您就是想以较低频率采样快周期图表，这是合理的选择。",
  bs_sources: "信号来源",
  bs_sources_note: "这些规则目前依赖的数据源。",
  bs_sources_help: "变暗的来源尚未接入。您的规则运行在已接入的那两个来源上 — 这里没有任何一项会悄悄失效。",

  acc_title: "分批建仓",
  acc_note: "对已持有的标的继续加仓。默认关闭。",
  acc_on: "分批建仓中",
  acc_off: "每个标的只买一次",
  acc_off_body: "智能体买入一次后便只管理该仓位。打开此项即可摊平成本 — 按计划、按下跌或按走强加仓。",
  acc_blend_warning:
    "您的止盈和止损现在衡量的是全部买入的加权平均成本，而不是每一笔单独计算。一个向下摊平了三次的仓位会作为一个整体出场。",
  acc_perlot_note: "现在每一笔买入都各自判断自己的止盈和止损。买入价最低的那一笔可以在自己反弹时单独卖出,其余的继续持有。",
  acc_perlot_title: "网格 — 每笔单独出场",
  acc_perlot_body:
    "关闭时,所有买入会合并为一个平均仓位。开启时,每一笔买入按自己的止盈止损单独出场 — 这就是网格交易。",
  acc_perlot_on: "按笔出场",
  acc_perlot_off: "合并计算",
  acc_when: "何时加仓",
  acc_schedule: "按计划",
  acc_falls: "下跌时",
  acc_rises: "上涨时",
  acc_falls_vol: "按波动率下跌时",
  acc_every: "每 {spacing}",
  acc_measure_bandwidth: "布林带宽",
  acc_measure_atr: "ATR",
  acc_falls_by: "下跌幅度",
  acc_rises_by: "上涨幅度",
  acc_vol_help:
    "每一档的间距是该标的自身波动率的这么多倍，并且每个周期重新读取 — 因此行情震荡时档位会自动放宽，平静时收紧。从您的平均成本起算。",
  acc_vol_help_atr: " ATR 是 14 根 K 线的平均真实波幅。",
  acc_vol_help_bandwidth: " 布林带宽是 20 周期布林带的宽度。",
  acc_vol_display: "−{multiple}× {measure}",
  acc_drawdown_help: "从您的平均成本起算，而不是从上一次建仓价起算。",
  acc_gain_help: "对盈利仓位加仓。从您的平均成本起算。",
  acc_guard_heading: "仅在仍然符合条件时",
  acc_guard_on: "重新检查我的规则",
  acc_guard_off: "无条件加仓",
  acc_guard_on_body:
    "每次加仓之前，智能体都会重新运行您设定的入场规则。如果该标的今天已经不再符合买入条件 — 流动性枯竭、出现坏消息、基本面转差 — 它就会停止加仓，只持有已有的仓位。",
  acc_guard_off_body:
    "智能体会按上面的条件持续买入，而不再重新检查您的规则。价格下跌时止损仍然保护您，但只要价格没跌，基本面变化就没有任何人会注意到。",
  acc_how_much: "每次加多少",
  acc_fixed: "固定金额",
  acc_share: "资金占比",
  acc_ladder: "递增阶梯",
  acc_each_add: "每次加仓",
  acc_fixed_help: "每次都是同样的金额。",
  acc_share_help: "按该智能体获配资金的一定比例。",
  acc_first_add: "首次加仓",
  acc_first_add_help: "阶梯的起点。",
  acc_grows_by: "每次加仓递增",
  acc_grows_help: "复利递增。2 倍阶梯会让第十次加仓达到第一次的 512 倍。",
  acc_where_stops: "何时停止",
  acc_most_adds: "最多加仓次数",
  acc_most_adds_help: "按单个仓位计算。仓位平掉后计数归零。",
  acc_wait_at_least: "最短间隔",
  acc_wait_help: "两次加仓之间的最短间隔，无论上面的条件是否满足。",
  acc_hours: "{n} 小时",
  acc_all_checks:
    "每一次加仓都要通过与首次买入相同的检查 — 单笔上限、合规、安全性筛查。加仓计划不会突破您在别处设定的任何限额。",

  sp_1h: "1 小时",
  sp_1d: "1 天",
  sp_1w: "1 周",
  sp_1mo: "1 个月",

  warn_drawdown_never: "在 −{pct}% 加仓几乎不会触发：{stop}% 的止损会先把仓位平掉。",
  warn_drawdown_tight:
    "在 −{pct}% 加仓，距离 {stop}% 的止损只剩 {gap} 个百分点 — 很可能刚买完就被更大的仓位止损出局。",
  warn_vol_crosses:
    "各档位设在 {multiple}× {measure}，因此只要波动率高于 {crossesAt}%，第一档就会跌破 {stop}% 的止损，仓位会在加仓之前先被平掉。",
  warn_gain_never: "在 +{pct}% 加仓几乎不会触发：{target}% 的止盈会先卖出。",
  warn_ceiling_below_first: "${ceiling} 的总上限低于首次加仓的 ${first}，因此这个计划永远不会买入。",
  warn_ladder_unbounded: "翻倍阶梯若不限制加仓次数，会迅速滚大。请设置一个上限。",

  plan_adds: "每次加仓 {size}",
  plan_size_pct: "资金的 {pct}%",
  plan_size_ladder: "{base}，每次递增 {factor} 倍",
  plan_every: "每 {spacing}",
  plan_when_down: "下跌 {pct}% 时",
  plan_when_down_vol: "下跌达到其 {measure} 的 {multiple} 倍时",
  plan_when_up: "上涨 {pct}% 时",
  plan_measure_atr: "ATR",
  plan_measure_bandwidth: "布林带宽",
  plan_guarded: "仅在规则仍然通过时",
  plan_max_adds: "最多 {n} 次",
  plan_up_to: "累计不超过 {amount}",
  plan_or: " 或 ",
  plan_and: " 且 ",
  rule_bollingerPctBMin: "最低布林 %B",
  rule_bollingerPctBMin_help:
    "价格在 20 根 K 线布林通道中的位置：0 为下轨，100 为上轨。接近 100 的下限要求收盘在上轨或之上 — 即突破。",
  rule_priceVsSma5Pct: "价格高于 MA5 的上限",
  rule_priceVsSma5Pct_help:
    "价格相对 5 根 K 线简单均线的百分比。0 或以下表示回踩均线；小的正数允许略高于均线。",
  rule_priceVsSma10Pct: "价格高于 MA10 的上限",
  rule_priceVsSma10Pct_help:
    "价格相对 10 根 K 线简单均线的百分比。0 或以下表示回踩均线。",
  rule_priceVsEma20Pct: "价格高于 EMA20 的上限",
  rule_priceVsEma20Pct_help:
    "价格相对 20 根 K 线指数均线的百分比。0 或以下表示回踩均线。",
  rule_priceVsEma50Pct: "价格高于 EMA50 的上限",
  rule_priceVsEma50Pct_help:
    "价格相对 50 根 K 线指数均线的百分比。0 或以下表示回踩均线。",
  rule_aboveLow60dPct: "高于 60 根 K 线低点的上限",
  rule_aboveLow60dPct_help:
    "价格从 60 根 K 线内最低收盘反弹的幅度。数值小则只放行仍靠近底部的资产。",
  rule_smaCrossUpBars: "金叉发生在几根 K 线内",
  rule_smaCrossUpBars_help:
    "20 均线上穿 50 均线距今不超过这么多根 K 线。这是一个事件，所以窗口很短。",
  rule_smaCrossDownBars: "死叉发生在几根 K 线内",
  rule_smaCrossDownBars_help:
    "20 均线下穿 50 均线距今不超过这么多根 K 线。",
  rule_macdCrossUpBars: "MACD 上穿在几根 K 线内",
  rule_macdCrossUpBars_help:
    "MACD 线上穿信号线距今不超过这么多根 K 线。",
  rule_macdCrossDownBars: "MACD 下穿在几根 K 线内",
  rule_macdCrossDownBars_help:
    "MACD 线下穿信号线距今不超过这么多根 K 线。",
  rule_volumeRatio: "最低成交量倍数（对 20 根均量）",
  rule_volumeRatio_help:
    "最后一根 K 线成交量相对其 20 根均量的倍数。1 是普通一根，2 是两倍。用它要求放量确认。",
  rule_buyPressurePct: "最低买盘压力",
  rule_buyPressurePct_help:
    "最近 14 根 K 线中上涨 K 线成交量占比（百分比）。高于 50 表示买方占优。",
  rule_adx: "最低趋势强度（ADX 14）",
  rule_adx_help:
    "不论方向，是否存在趋势。低于 20 为震荡；高于 25 为趋势市。仅限代币 — 需要每根 K 线的最高最低价。",
  rule_stochasticK: "最高随机指标 %K（14）",
  rule_stochasticK_help:
    "收盘价在最近 14 根 K 线区间中的位置：0 在低点，100 在高点。上限避免在区间顶部买入。仅限代币。",
  rule_stochasticKMin: "最低随机指标 %K（14）",
  rule_stochasticKMin_help:
    "收盘价在最近 14 根 K 线区间中的位置。下限要求强势 — 收盘靠近区间顶部。仅限代币。",
  rule_cci: "最高 CCI（20）",
  rule_cci_help:
    "20 根 K 线的顺势指标。高于 +100 为过度拉伸；上限避免追高。仅限代币。",
  rule_mfi: "最高资金流量指数（14）",
  rule_mfi_help:
    "以成交量加权的 RSI，取 14 根 K 线。高于 80 为过度买入。仅限代币。",
  rule_vwapDistPct: "高于 VWAP 的上限",
  rule_vwapDistPct_help:
    "价格相对 20 根 K 线成交量加权均价的百分比。0 或以下要求价格不高于主要成交区。仅限代币。",
  rule_barVolumeUsd: "最后一根 K 线的最低成交额",
  rule_barVolumeUsd_help:
    "你所选 K 线周期最后一根的美元成交额。“每根 15 分钟 K 线至少 $500”就是在 15 分钟周期上把此规则设为 500。",
  rule_avgBarVolumeUsd: "每根 K 线的最低平均成交额",
  rule_avgBarVolumeUsd_help:
    "最近 20 根 K 线每根的平均美元成交额。要求持续成交，而不是某一根放量。",
  rule_priceUsd: "最低价格",
  rule_priceUsd_help:
    "美元价格下限。“只在 $2 以上”，或作为两段式入场的观察条件：“到 $1 之后”。是价位，不是涨跌幅。",
  rule_priceUsdMax: "最高价格",
  rule_priceUsdMax_help:
    "美元价格上限。“$180 以下买入”，或作为信号离场时的硬止损价位。是价位，不是涨跌幅。",
  rule_launchAgeMinutes: "上线后最少分钟数",
  rule_launchAgeMinutes_help:
    "跳过建池后的最初几分钟，那时价格是纯噪音，跑路仍可能发生。",
  rule_launchAgeMinutesMax: "上线后最多分钟数",
  rule_launchAgeMinutesMax_help:
    "只要比这更年轻的代币。建池那一刻从链上读取。",
  rule_changeSinceLaunchPct: "较发行价最低涨幅",
  rule_changeSinceLaunchPct_help:
    "价格相对建池后记录的第一个价格。无需 K 线历史。",
  rule_changeSinceLaunchPctMax: "较发行价最高涨幅",
  rule_changeSinceLaunchPctMax_help:
    "排除已经偏离发行价太远的代币。",
  rule_drawdownFromLaunchHighPct: "较上线高点最小回撤",
  rule_drawdownFromLaunchHighPct_help:
    "价格自上线以来最高点的回落幅度。相当于上线阶段的 60 根 K 线高点。",
  rule_liquidityGrowthPct: "最低流动性增长",
  rule_liquidityGrowthPct_help:
    "池子当前流动性相对开池时。负值表示流动性在流出。",
  rule_volume5mUsd: "5 分钟最低成交额",
  rule_volume5mUsd_help:
    "最近五分钟的美元成交额，实时刷新。",
  rule_buySellRatio5m: "5 分钟最低买卖比",
  rule_buySellRatio5m_help:
    "最近五分钟买入笔数除以卖出笔数。1 为均衡，大于 1 买方更多。",
  rule_holderCount: "最少持有人数",
  rule_holderCount_help:
    "持有该代币的钱包数，实时刷新。",
  rule_top10HolderPct: "前十大持仓最高占比",
  rule_top10HolderPct_help:
    "前十大钱包持有的供应量比例。越低越分散。",
  rule_creatorHoldingPct: "创建者最高持仓",
  rule_creatorHoldingPct_help:
    "建池钱包仍持有的供应量比例。",
  rule_sellImpactPct: "卖出 $100 的最高成本",
  rule_sellImpactPct_help:
    "此刻 $100 一买一卖在池子里的损耗。越小越容易退出。",
  acc_from_heading: "以什么为基准",
  acc_from_help:
    "均价会随每次买入而下降，以均价为基准的档位在下跌途中会越挤越密。以上一次成交为基准，每一档都在上一次买入之下相同距离 — 这才是网格。",
  acc_from_average: "我的均价",
  acc_from_last: "上一次成交",
  acc_growth: "逐档加宽",
  acc_growth_help:
    "每执行一档，间距乘以该系数。5% 档位配 1.5× 即 5%、7.5%、11.25% — 越跌间距越大的递进式间距。",
  acc_growth_even: "等距",
  acc_growth_display: "每档 {factor}×",
  acc_depth: "最深不超过",
  acc_depth_help:
    "网格的下限，以首次入场价为基准。覆盖 33% 跌幅的网格，在价格低于起点 33% 之后不再加仓，无论还剩多少档。",
  acc_depth_display: "低于首次入场 {pct}%",
  acc_depth_off: "无下限",
  plan_from_last: "（以上一次成交为基准）",
  plan_widening: "，每档加宽 {factor}×",
  plan_depth: "最深 {pct}%",
  plan_every_days: "{n} 天",
  plan_every_hours: "{n} 小时",
  plan_every_minutes: "{n} 分钟",

  rule_borrowAprPct: "最高借款利率（年化）",
  rule_borrowAprPct_help: "池子向开仓方向收取的年化利率。随池使用率上升。仅永续市场。",
  rule_utilizationPct: "最高池使用率",
  rule_utilizationPct_help: "池子中已被持仓锁定的比例。越过拐点后借款利率急剧上升。仅永续市场。",
  rule_fundingRateHourlyPct: "最高小时资金费率",
  rule_fundingRateHourlyPct_help: "为正表示多头付给空头。Jupiter 这类池子场所为零；订单簿场所为实时值。仅永续市场。",
  rule_fundingRateHourlyPctMin: "最低小时资金费率",
  rule_fundingRateHourlyPctMin_help: "至少形式：仅当多头每小时至少支付这么多时才做空。仅永续市场。",
  rule_openInterestImbalancePct: "最高持仓失衡",
  rule_openInterestImbalancePct_help: "多空未平仓量的不平衡程度，占较大一侧的百分比。拥挤的一侧容易被挤压。仅永续市场。",
};
