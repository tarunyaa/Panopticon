export interface OnboardingAgent {
  name: string;       // avatar character name (e.g. "Abigail") — auto-derived from spriteKey
  role: string;       // job role (e.g. "Architect") — user/template defined
  goal: string;
  backstory: string;
  task_description: string;
  expected_output: string;
  spriteKey: string;  // AVATARS key like "Abigail_Chen"
}

export interface TemplatePreset {
  label: string;
  agents: Omit<OnboardingAgent, "spriteKey" | "name">[];
}

export const TEMPLATES: TemplatePreset[] = [
  {
    label: "Development",
    agents: [
      {
        role: "Architect",
        goal: "Design system architecture and technical specs",
        backstory: "A seasoned software architect with deep expertise in distributed systems and clean architecture principles.",
        task_description: "Analyze requirements and produce a detailed architecture document with component diagrams and API contracts.",
        expected_output: "Architecture design document with system diagrams and technical specifications.",
      },
      {
        role: "Backend Engineer",
        goal: "Implement APIs, services, and data models",
        backstory: "A backend engineer skilled in building reliable APIs and data pipelines with a focus on performance and scalability.",
        task_description: "Implement the backend services, REST APIs, and database models according to the architecture spec.",
        expected_output: "Working backend implementation with API endpoints and data models.",
      },
      {
        role: "Frontend Engineer",
        goal: "Build user interfaces and client logic",
        backstory: "A frontend engineer who crafts intuitive, responsive interfaces with modern frameworks and pixel-perfect attention to detail.",
        task_description: "Build the frontend UI components and client-side logic that integrate with the backend APIs.",
        expected_output: "Functional frontend application with all UI components and API integrations.",
      },
      {
        role: "QA Engineer",
        goal: "Write tests and validate quality",
        backstory: "A quality assurance engineer with a keen eye for edge cases and a passion for test automation.",
        task_description: "Write comprehensive test suites and perform validation to ensure the system meets quality standards.",
        expected_output: "Test suite with passing tests and a quality validation report.",
      },
    ],
  },
  {
    label: "Content",
    agents: [
      {
        role: "Content Strategist",
        goal: "Plan content themes and calendar",
        backstory: "A content strategist who understands audience engagement and develops compelling editorial calendars.",
        task_description: "Research the target audience and create a content strategy with themes, topics, and a publishing calendar.",
        expected_output: "Content strategy document with editorial calendar and topic outlines.",
      },
      {
        role: "Writer",
        goal: "Draft compelling copy and articles",
        backstory: "A prolific writer who transforms complex ideas into clear, engaging prose that resonates with readers.",
        task_description: "Write articles, blog posts, and copy based on the content strategy and assigned topics.",
        expected_output: "Completed draft articles and copy ready for editorial review.",
      },
      {
        role: "Editor",
        goal: "Review, refine, and polish content",
        backstory: "An editor with a sharp eye for grammar, style, and narrative flow who ensures every piece meets publication standards.",
        task_description: "Review all drafted content for clarity, grammar, style consistency, and factual accuracy.",
        expected_output: "Polished, publication-ready content with editorial notes and revisions.",
      },
    ],
  },
  {
    label: "Research",
    agents: [
      {
        role: "Research Lead",
        goal: "Define methodology and research questions",
        backstory: "A research lead experienced in designing rigorous studies and formulating precise research questions.",
        task_description: "Define the research methodology, key questions, and data collection approach for the project.",
        expected_output: "Research plan with methodology, questions, and data collection framework.",
      },
      {
        role: "Data Analyst",
        goal: "Gather and analyze data for insights",
        backstory: "A data analyst adept at extracting meaningful patterns from complex datasets using statistical methods.",
        task_description: "Collect relevant data, perform statistical analysis, and identify key trends and insights.",
        expected_output: "Data analysis report with visualizations and key findings.",
      },
      {
        role: "Report Writer",
        goal: "Synthesize findings into clear reports",
        backstory: "A report writer skilled at synthesizing complex research into clear, actionable documents for stakeholders.",
        task_description: "Compile research findings and data analysis into a comprehensive, well-structured report.",
        expected_output: "Final research report with executive summary, findings, and recommendations.",
      },
    ],
  },
];
