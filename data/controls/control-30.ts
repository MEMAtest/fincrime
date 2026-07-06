import type { Control } from "./types";

export const control30: Control = {
  id: 30,
  slug: "account-takeover-detection",
  name: "Account Takeover Detection",
  category: "transaction_monitoring",
  controlType: "detective",
  plainSummary:
    "The firm spots when someone other than the real customer has gained control of an account, by watching for sudden changes in device, login and payment behaviour.",
  objective:
    "Detect compromise of a legitimate customer's account, where a third party has obtained credentials or control, and intervene before fraudulent payments leave or the account is repurposed as a mule.",
  plainObjective: "Spots when someone other than the real customer has taken over their account, and steps in before fraudulent payments leave or the account is turned into a mule.",
  plainHowItWorks: "It learns each customer's usual devices, locations and payment habits, then scores sessions for takeover signs like a new device plus a fast payee change and payment, forcing step-up and holding risky payments.",
  plainWhyThreshold: "The new-device, credential-change, new-payee and payment combination is the classic takeover sequence that rarely happens innocently, and the short time window reflects how fast stolen funds are cashed out.",
  riskThemes: ["fraud", "money_laundering"],
  applicableFirmTypes: ["bank", "neobank", "emi", "msb", "crypto", "pi"],
  typologySlugs: ["account-takeover-fraud", "app-fraud-push-payments", "mule-account-activity"],
  enforcementRefs: [{ firm: "Starling Bank Limited", year: 2024 }],
  dataInputs: [
    "Login events (device, IP, geolocation, success/failure, time)",
    "Device-binding and new-device registration events",
    "Credential and contact-detail change events (password, phone, email, address)",
    "Step-up authentication and SCA outcomes",
    "Payee/beneficiary additions and limit changes",
    "Outbound payment behaviour vs the customer's baseline",
  ],
  ruleLogic:
    "Build a per-customer behavioural baseline of devices, locations, login times and payment patterns. Score sessions for takeover risk from anomalies: login from a new device plus a new country, a contact-detail change followed quickly by a new payee and a large payment, disabling of notifications, or impossible-travel between logins. When the takeover score crosses the threshold, step-up authentication is forced and outbound payments to new payees are held pending verification. Confirmed takeovers freeze the account and trigger recovery.",
  defaultThreshold:
    "Hold and step-up when, within 60 minutes, an account shows a new-device login AND a contact-detail or credential change AND a new-payee payment; force step-up on any new-device login followed by a faster-payment to a new payee exceeding GBP 1,000.",
  thresholdRationale:
    "The combined-signal pattern (new device + credential change + new payee + payment in a short window) is the classic account-takeover sequence and rarely occurs benignly, so it justifies an automated hold. The GBP 1,000 new-payee figure catches the first fraudulent push payment while letting routine small transfers through; the 60-minute window reflects how fast takeover-to-cash-out runs. Tune both against confirmed ATO outcomes.",
  lookbackWindow:
    "Session scoring uses a rolling 90-day behavioural baseline; the trigger sequence is evaluated over a rolling 60-minute window.",
  tuningNotes:
    "Expect noise from genuine customers who travel, change phones or buy a new device; suppress these with device-binding history and trusted-location learning rather than by weakening the core sequence rule. Watch the step-up friction rate so legitimate customers are not over-challenged, and the value held so genuine large payments are not blocked en masse. Retrain the baseline and tune the value threshold monthly using confirmed ATO and APP-fraud cases.",
  firstLineOwner: "Fraud Operations / Transaction Fraud team",
  secondLineOwner: "Fraud Risk and MLRO / Financial Crime Compliance",
  suggestedSystems: [
    "Behavioural biometrics and session-risk engine (e.g. BioCatch, Featurespace)",
    "Device intelligence and binding service",
    "Real-time payment-fraud / transaction monitoring platform",
    "Step-up authentication / SCA orchestration",
  ],
  escalation:
    "Confirmed takeovers freeze the account, reverse or recall in-flight payments where possible, notify the customer through a verified channel, and refer to Fraud Operations; where the account was being repurposed as a mule the MLRO is notified and a SAR is considered.",
  sla: "Real-time hold and step-up at the point of the risky action; analyst confirmation of held cases within 30 minutes during operating hours.",
  metrics: [
    {
      name: "ATO detection rate",
      target: ">= 90% of confirmed takeovers caught before funds leave",
      description: "Share of confirmed account-takeover events detected and intervened before loss.",
    },
    {
      name: "Fraud value prevented",
      target: "Tracked and trending up as coverage improves",
      description: "Monetary value of held or recalled payments on detected takeovers.",
    },
    {
      name: "Legitimate step-up friction rate",
      target: "< 2% of genuine sessions challenged",
      description: "Genuine customers subjected to unnecessary step-up, a measure of over-blocking.",
    },
  ],
  testPlan: [
    "Replay a recorded takeover sequence (new device, email change, new payee, large payment within minutes) and confirm the payment is held and step-up forced.",
    "Simulate a genuine customer travelling abroad with a known device and confirm they are not blocked.",
    "Test impossible-travel between two logins minutes apart and confirm the session is scored high and challenged.",
    "Confirm a frozen account on confirmed takeover triggers customer notification through a verified channel and a recall attempt on in-flight payments.",
  ],
  reviewCadence: "Rules and baselines tuned monthly against confirmed ATO cases; control design reviewed annually.",
  governance: [
    "Fraud Risk approves detection rules, thresholds and the step-up policy.",
    "Monthly MI on detection rate, value prevented and false-challenge rate to the Fraud and Financial Crime Committee.",
    "Confirmed ATO cases fed back to retrain behavioural baselines, with the loop documented.",
    "Session, device and intervention logs retained for at least five years.",
  ],
  whatGoodLooksLike: [
    "Detection is based on a behavioural baseline, not a single static rule, so it catches the takeover sequence as a whole.",
    "Risky payments are held in real time before funds leave, not flagged after settlement.",
    "Genuine travel and device changes are absorbed by device-binding history, keeping false challenges low.",
    "Confirmed cases continuously retrain the model and link to mule and SAR workflows.",
  ],
  strongVsWeak: {
    strong:
      "A customer's account logs in from a new device in another country, the registered email is changed, a new payee is added and a GBP 4,000 faster payment is attempted, all within twenty minutes; the engine scores the session as a takeover, holds the payment, forces step-up that the fraudster cannot pass, freezes the account and recalls nothing because nothing left.",
    weak:
      "The same sequence completes because the firm only checks the payment value in isolation, GBP 4,000 is under the generic monitoring threshold, the money is gone, and the takeover is only recognised days later from the customer's complaint.",
  },
  sources: [
    {
      org: "FCA",
      reference: "FCA Financial Crime Guide",
      title: "FCA Financial Crime Guide",
      url: "https://www.handbook.fca.org.uk/handbook/FCG/",
    },
    {
      org: "JMLSG",
      reference: "Part I, Chapter 5",
      title: "JMLSG Guidance - Monitoring Customer Activity",
      url: "https://www.jmlsg.org.uk/guidance/current-guidance/",
    },
    {
      org: "Wolfsberg",
      reference: "Wolfsberg Standards",
      title: "Wolfsberg Standards - Monitoring, Screening and Searching",
      url: "https://www.wolfsberg-principles.com/",
    },
    {
      org: "FATF",
      reference: "Recommendation 10",
      title: "FATF Recommendations - Ongoing Monitoring",
      url: "https://www.fatf-gafi.org/en/recommendations.html",
    },
  ],
};
