import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Code2,
  GitBranch,
  Hash,
  Layers3,
  MessageCircle,
  MessagesSquare,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Video,
  Workflow,
} from "lucide-react";
import Link from "next/link";

const proofPoints = [
  { label: "Memory source", value: "Chat + repos" },
  { label: "Retrieval", value: "Workspace scoped" },
  { label: "Output", value: "Cited answers" },
];

const problemCards = [
  {
    title: "Decisions vanish",
    text: "Important context gets buried across chat threads, commits, standups, and ticket comments.",
  },
  {
    title: "Status becomes vibes",
    text: "A teammate says a feature is done, but the repo may tell a different story.",
  },
  {
    title: "Handoffs are expensive",
    text: "New contributors spend hours asking where things live and what already happened.",
  },
];

const workflowSteps = [
  {
    icon: MessagesSquare,
    title: "Talk where work happens",
    text: "Each workspace gets a realtime group chat for project updates, decisions, and questions.",
  },
  {
    icon: Code2,
    title: "Connect the repository",
    text: "GitHub repos can be synced, chunked, embedded, and searched alongside team discussion.",
  },
  {
    icon: Search,
    title: "Ask the project",
    text: "Use /ask to retrieve relevant chat and repository evidence, then generate a cited answer.",
  },
  {
    icon: ShieldCheck,
    title: "Keep context scoped",
    text: "Workspace membership and Supabase RLS keep memory isolated to the right team.",
  },
];

const roadmap = [
  {
    status: "In progress",
    title: "Slack integration",
    text: "Bring existing Slack project channels into the same searchable context brain.",
  },
  {
    status: "Planned",
    title: "Linear and ticket tools",
    text: "Connect ticket history from Linear, Jira-style systems, and project trackers.",
  },
  {
    status: "Future scope",
    title: "Telegram and team chat",
    text: "Extend context capture into Telegram groups and other team communication spaces.",
  },
  {
    status: "Future scope",
    title: "Meetings and calls",
    text: "Attach Google Meet notes, standup summaries, and decision transcripts to projects.",
  },
];

const answerLines = [
  "In adarshnub/animedb_website, I do not see auth routes or middleware.",
  "Chat note: Adarsh said auth was implemented at 5:04 PM.",
  "Recommendation: sync latest branch or verify whether auth lives in another repo.",
];

export default function Home() {
  return (
    <main className="landing-canvas min-h-screen overflow-hidden">
      <div className="landing-orb landing-orb-a" />
      <div className="landing-orb landing-orb-b" />

      <div className="app-shell relative z-10 py-6">
        <header className="animate-rise flex items-center justify-between rounded-2xl border border-white/60 bg-white/55 px-4 py-3 shadow-[0_18px_70px_rgba(19,32,29,0.1)] backdrop-blur-2xl">
          <Link className="flex items-center gap-3" href="/">
            <span className="grid size-11 place-items-center rounded-xl bg-[#10211c] text-lime-200 shadow-lg shadow-emerald-950/20">
              <Sparkles size={19} />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[-0.02em] text-[var(--ink)]">
                Org Context
              </span>
              <span className="block text-xs font-semibold text-[var(--muted)]">
                Your project workflow brain
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link className="btn-ghost hidden sm:inline-flex" href="/login">
              Log in
            </Link>
            <Link className="btn-primary rounded-xl" href="/signup">
              Start now <ArrowRight size={16} />
            </Link>
          </nav>
        </header>

        <section className="grid min-h-[calc(100vh-5.75rem)] gap-10 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <div className="animate-rise max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/60 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[var(--teal)] shadow-sm backdrop-blur">
              <Radio size={14} />
              Live context for fast-moving teams
            </div>

            <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[0.95] tracking-[-0.07em] text-[var(--ink)] md:text-7xl lg:text-8xl">
              Give every project a memory that answers back.
            </h1>

            <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-[var(--muted)] md:text-xl">
              Org Context turns workspace chat, GitHub repositories, and future
              workflow integrations into one searchable project memory. Ask
              what changed, what was decided, and whether the repo agrees with
              the conversation.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn-primary rounded-xl px-5" href="/signup">
                Build your first workspace <ArrowRight size={16} />
              </Link>
              <Link className="btn-secondary rounded-xl px-5" href="/login">
                Open dashboard
              </Link>
            </div>

            <div className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
              {proofPoints.map((point, index) => (
                <div
                  className={`animate-rise landing-metric stagger-${index + 1}`}
                  key={point.label}
                >
                  <p className="font-mono text-[0.67rem] font-semibold uppercase text-[var(--teal)]">
                    {point.label}
                  </p>
                  <p className="mt-2 text-base font-black text-[var(--ink)]">
                    {point.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="animate-rise stagger-2 landing-console">
            <div className="landing-console-header">
              <div>
                <p className="eyebrow">Workspace signal</p>
                <h2 className="mt-1 text-lg font-black text-[var(--ink)]">
                  AnimeDB project check
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                <span className="size-2 rounded-full bg-emerald-500 [animation:pulse-soft_1.4s_ease-in-out_infinite]" />
                Live
              </span>
            </div>

            <div className="landing-signal-grid">
              <div className="landing-chat-card">
                <p className="text-xs font-black text-[var(--teal)]">Adarsh</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  implemented an authentication system in animedb project
                </p>
              </div>

              <div className="landing-ask-card">
                <p className="text-xs font-black text-lime-200">/ask</p>
                <p className="mt-2 text-sm leading-6 text-white">
                  is there an authentication system implemented in animedb?
                </p>
              </div>

              <div className="landing-answer-card">
                <div className="mb-3 flex items-center gap-2">
                  <BrainCircuit size={16} />
                  <p className="text-xs font-black uppercase">Org Context</p>
                </div>
                <div className="space-y-2">
                  {answerLines.map((line) => (
                    <p className="text-sm leading-6 text-slate-700" key={line}>
                      {line}
                    </p>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="landing-chip">Chat source 0.349</span>
                  <span className="landing-chip">Repo package.json</span>
                  <span className="landing-chip">Repo app/page.tsx</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 py-10 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="animate-rise surface p-6">
            <p className="eyebrow">Problem statement</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--ink)] md:text-4xl">
              Project truth is split across too many places.
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Teams already have the raw signal: chat, pull requests, repo
              history, tickets, calls, and docs. The hard part is turning those
              fragments into a reliable answer when someone asks what is the
              actual state of this feature?
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {problemCards.map((card, index) => (
              <article
                className={`animate-rise landing-problem-card stagger-${index + 1}`}
                key={card.title}
              >
                <span className="grid size-9 place-items-center rounded-lg bg-[#10211c] text-lime-200">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-black text-[var(--ink)]">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  {card.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-10">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">How it works</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--ink)] md:text-5xl">
                Simple integration with existing workflows.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[var(--muted)]">
              No new ritual for the team. Capture the work already happening,
              embed it safely, and let `/ask` retrieve the most relevant project
              context when decisions get fuzzy.
            </p>
          </div>

          <div className="landing-flow">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article
                  className={`animate-rise landing-flow-card stagger-${index + 1}`}
                  key={step.title}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="grid size-12 place-items-center rounded-xl bg-white text-[var(--teal)] shadow-sm">
                      <Icon size={22} />
                    </span>
                    <span className="font-mono text-xs font-black text-[var(--muted)]">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-black text-[var(--ink)]">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {step.text}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="animate-rise landing-solve-panel">
            <div className="relative z-10">
              <p className="eyebrow text-lime-200">What we solve</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.04em] text-white md:text-5xl">
                A shared memory layer that can disagree intelligently.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-50/80">
                Org Context does not just summarize chat. It compares team
                claims with repository evidence, cites the sources, and keeps
                answers scoped to the active workspace.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  "Realtime workspace communication",
                  "GitHub repository indexing",
                  "Cohere embeddings and vector search",
                  "Cited /ask answers across chat and repo context",
                ].map((item) => (
                  <div className="flex items-center gap-3" key={item}>
                    <CheckCircle2 className="text-lime-200" size={18} />
                    <span className="text-sm font-bold text-white">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="animate-rise stagger-2 grid gap-4">
            <div className="landing-mini-card">
              <Workflow className="text-[var(--teal)]" size={22} />
              <h3 className="mt-4 text-lg font-black text-[var(--ink)]">
                Workflow-aware answers
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Answers can include what the repo shows, what teammates said,
                and which source is more reliable for implementation state.
              </p>
            </div>
            <div className="landing-mini-card">
              <Layers3 className="text-[var(--teal)]" size={22} />
              <h3 className="mt-4 text-lg font-black text-[var(--ink)]">
                One workspace, many signals
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                v1 starts with chat and GitHub. The roadmap adds the channels
                where work already lives.
              </p>
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">Roadmap</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--ink)] md:text-5xl">
                More integrations, less context hunting.
              </h2>
            </div>
            <Link className="btn-primary rounded-xl" href="/signup">
              Create your context brain <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {roadmap.map((item, index) => {
              const Icon =
                item.title === "Slack integration"
                  ? Hash
                  : item.title === "Linear and ticket tools"
                    ? TicketCheck
                    : item.title === "Meetings and calls"
                      ? Video
                      : MessageCircle;

              return (
                <article
                  className={`animate-rise landing-roadmap-card stagger-${index + 1}`}
                  key={item.title}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Icon className="text-[var(--teal)]" size={22} />
                    <span className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-black uppercase text-[var(--teal)]">
                      {item.status}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-black text-[var(--ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {item.text}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="animate-rise my-10 overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/60 p-6 shadow-[0_28px_90px_rgba(19,32,29,0.12)] backdrop-blur-2xl md:p-8">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-lime-100 px-3 py-1.5 text-xs font-black uppercase text-lime-800">
                <GitBranch size={14} />
                Start with one workspace
              </div>
              <h2 className="text-3xl font-black tracking-[-0.04em] text-[var(--ink)] md:text-5xl">
                Give your project a memory before the next handoff.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                Create a workspace, invite teammates, connect a repo, and start
                asking better project questions in minutes.
              </p>
            </div>
            <Link className="btn-primary rounded-xl px-5" href="/signup">
              Get started <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
