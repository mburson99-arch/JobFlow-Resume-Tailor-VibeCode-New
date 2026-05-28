import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import AdmZip from "adm-zip";
import { addLog, readJSONFile, storagePaths, writeJSONFile } from "./src/server/storage";

dotenv.config();

function readEnv(name: string): string {
  const raw = process.env[name];
  if (!raw) return "";
  return raw.trim().replace(/^['"]|['"]$/g, "");
}

const googleClientId = readEnv("GOOGLE_CLIENT_ID");

const app = express();
const PORT = 3000;

// Enable JSON parsing
app.use(express.json());

// Enable CORS for Chrome Extension requests (Indeed/LinkedIn cross-origin fetches)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Gemini SDK with Telemetry User-Agent
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set. AI features will fallback to simulation.");
}

const { jobs: JOBS_FILE, emails: EMAILS_FILE, profile: PROFILE_FILE, logs: LOGS_FILE, deletedJobs: DELETED_JOBS_FILE } = storagePaths;

// Initialize databases if they do not exist
if (!fs.existsSync(PROFILE_FILE)) {
  writeJSONFile(PROFILE_FILE, {
    name: "Michael Burson",
    email: "mburson99@gmail.com",
    phone: "740.755.0345",
    website: "https://github.com/mburson99-arch",
    resumeText: `MICHAEL BURSON
IT Support Specialist | Help Desk Technician | Ohio

Mobile: 740.755.0345 | Email: mburson99@gmail.com | Portfolio: https://github.com/mburson99-arch | LinkedIn: https://linkedin.com/in/michaelburson

PROFESSIONAL SUMMARY
Dedicated and results-oriented IT Support Specialist leveraging 2 years of direct help desk experience and a robust 5-year background in remote operations and logistics, offering a unique blend of technical aptitude and proven problem-solving abilities. Transitioning into a focused IT career, I excel at strict SLA adherence, high-stakes client de-escalation, and independent field troubleshooting, consistently demonstrating zero-supervision autonomy. My technical foundation is solid, built through a self-hosted 4-VM enterprise service desk lab with Active Directory, RBAC, and simulated GPO failures, complemented by active studies for CompTIA A+ certification and a completed Google Cybersecurity Professional Certificate. I bring a proactive, customer-focused attitude and a strong commitment to service excellence, eager to contribute these to Sentinel Technologies.

TECHNICAL SKILLS
* Operating Systems: Windows 10/11, Windows Server, macOS, Apple iOS, Android OS
* Networking: DNS, DHCP, VPN, LAN/WAN, Cisco Meraki, TCP/IP
* Directory Services: Active Directory, Group Policy Objects (GPO)
* Microsoft Ecosystem: Microsoft 365 Administration Suite (user/license management), OneDrive, SharePoint
* Endpoint Management: SCCM, Intune, Autopilot (lab experience)
* Help Desk & Ticketing: Jira, ServiceNow (familiarity), Zendesk
* Monitoring & Tools: Splunk (log analysis), PowerShell, Git, VS Code, Google Workspace (G-Suite familiarity)
* Security Concepts: Multi-Factor Authentication (MFA) implementation, Workstation & Server Patching

WORK EXPERIENCE
IT Support Specialist Co-op | TechSolutions | June 2024 - Present
* Served as the primary point of contact for diverse technical support requests, handling incoming incidents via ticketing system, phone, and email, ensuring comprehensive incident documentation.
* Resolved end-user Tier 1 and Tier 2 hardware, software, and basic network issues, consistently maintaining 99% SLA compliance for incident resolution.
* Managed user accounts and permissions within Active Directory, including provisioning, de-provisioning, and modification of security groups and access controls (RBAC).
* Assisted with corporate machine imaging via SCCM and facilitated active profile management to ensure optimal end-user experience and security compliance.
* Provisioned and troubleshot remote-worker VPN accounts, resolving client networking issues to ensure seamless connectivity and productivity.
* Documented all technical support activities, resolutions, and user interactions with meticulous detail, contributing to audit-ready data trails and an accurate knowledge base.

TECHNICAL PROJECTS & LAB ENVIRONMENTS
* Self-Hosted Enterprise Service Desk Lab: Designed, deployed, and administered a 4-VM virtualized IT environment mimicking an enterprise network, including Windows Server, Active Directory Domain Services, DNS, DHCP, and a fully functional ticketing system. Configured Role-Based Access Control (RBAC) and simulated GPO failures to troubleshoot and harden domain policies.
* Splunk Integration for Security Monitoring: Integrated Splunk for real-time system log analysis, network traffic monitoring, and security event correlation within the lab environment, enhancing threat detection and troubleshooting capabilities.
* Endpoint Management Exploration: Gained hands-on experience with Microsoft Intune and Autopilot for cloud-based device management, deployment, and patching processes within a lab setting.
* MFA Solution Deployment: Researched and simulated the implementation of Multi-Factor Authentication (MFA) solutions for enhanced account security across various services.
* Apple & Android Device Support Practice: Configured and troubleshot virtualized Apple iOS and Android OS devices, including common network and application issues.

EDUCATION
B.S. in Information Technology | Ohio University | Graduated May 2024

CERTIFICATIONS
* Google Cybersecurity Professional Certificate (Completed)
* CompTIA A+ (In Progress, expected 2026)`,
  });
}

if (!fs.existsSync(JOBS_FILE)) {
  writeJSONFile(JOBS_FILE, [
    {
      id: "job-9xfrz5y",
      title: "IT Support Specialist - job post",
      company: "Mercer Bucks Technology",
      url: "https://www.indeed.com/jobs?q=it+support&l=Remote&radius=25&from=searchOnDesktopSerp%2Cwhereautocomplete&vjk=13a1127297189f0e",
      description: `Job Overview
We are seeking a dynamic and motivated IT Support Specialist to join our technology team! In this role, you will be the frontline hero for resolving technical issues, supporting users across various platforms, and maintaining our IT infrastructure. Your energetic approach and problem-solving skills will ensure seamless technology operations, empowering our organization to achieve its goals efficiently. This paid position offers an exciting opportunity to develop your expertise in a fast-paced, innovative environment while delivering exceptional customer service and technical support.

Responsibilities

Provide prompt and effective technical support to end-users via help desk tickets, phone, or in-person interactions.
Troubleshoot software issues across multiple operating systems including Windows, macOS, and Linux, ensuring quick resolution.
Manage computer hardware components such as desktops, laptops, mobile devices, printers, and peripherals to optimize performance.
Support network administration tasks including configuring and maintaining LAN (Local Area Network), WAN (Wide Area Network), VPN (Virtual Private Network), DNS (Domain Name System), and firewall settings like Meraki devices.
Assistant with software deployment, updates, and patch management using tools such as SCCM (System Center Configuration Manager) and GPO (Group Policy Objects).
Monitor and maintain IT infrastructure components including Windows Server environments, Active Directory, TCP/IP protocols, and network security measures.
Utilize service management tools like ServiceNow, Jira, BMC Remedy, or similar platforms for incident tracking and resolution documentation.
Collaborate with team members on network administration tasks including TCP/UDP analysis, DNS configuration, and troubleshooting connectivity issues.
Support remote users by configuring VPN access and troubleshooting connectivity problems on mobile devices and laptops.

Requirements

Proven experience providing technical support in a fast-paced environment with excellent customer service skills.
Strong troubleshooting skills across software applications and hardware components.
Hands-on experience managing computer networks including LAN/WAN setup, TCP/IP protocols, DNS configuration, firewalls (e.g., Meraki), and VPNs.
Familiarity with operating systems such as Windows (including Windows Server), macOS, and Linux distributions.
Knowledge of IT support tools like SCCM for software deployment and GPO for policy management.
Experience with help desk ticketing systems such as ServiceNow or BMC Remedy is highly desirable.
Ability to communicate complex technical information clearly to non-technical users.
Analysis skills to diagnose issues quickly and implement effective solutions efficiently. Join us to be part of a vibrant team dedicated to leveraging technology to drive success! Your expertise will help create a resilient IT environment that supports innovation while delivering outstanding service to all users.

Pay: $26.45 - $31.85 per hour

Benefits:

Dental insurance
Paid time off

Work Location: Remote`,
      dateCaptured: "2026-05-26T04:08:29.267Z",
      status: "submitted",
      matchScore: 78,
      originalResume: `MICHAEL BURSON New Concord, OH | 740.755.0345 | Mburson99@gmail.com LinkedIn: 
www.linkedin.com/in/mjburson | Portfolio: github.com/mburson99-arch/AD-splunk-lab 
PROFESSIONAL SUMMARY Disciplined, customer-focused professional with over 5 years of 
remote operational experience transitioning into IT. Proven expertise managing strict SLAs, 
handling high-stakes client escalations, and maintaining productivity in self-directed 
environments. Armed with practical IT infrastructure expertise in Windows OS, Active Directory 
(Password Resets/Unlocks), and VPN troubleshooting built through enterprise simulations. 
Ready to provide first-line support to enterprise employees and ensure minimal downtime. 
TECHNICAL SKILLS 
● Systems Administration: Active Directory (ADUC), Group Policy Objects (GPOs), 
RBAC (Role-Based Access Control), Windows Server/Client OS 
● Network & Security Support: Multi-VM Architecture, VPN Troubleshooting, DNS/DHCP 
Configuration, Remote Desktop Protocol (RDP) 
● Operations & Diagnostics: Enterprise Incident Simulation, SLA Management, Remote 
Software Deployment, Root-Cause Documentation 
● Soft Skills: High-Pressure Communication, Incident Resolution, Technical Translation, 
Team Collaboration 
FEATURED TECHNICAL PROJECT Enterprise Service Desk & Identity Management Lab | 
Self-Hosted | Dec 2024 – Present Engineered a virtualized sandbox environment to master 
Level 1 Helpdesk operations, systems administration, and live infrastructure troubleshooting. 
● Multi-VM Architecture: Successfully built and networked a 4-Virtual Machine topology 
to run in tandem, simulating an enterprise server-client environment on the first iteration. 
● Access Control & RBAC: Created users and applied Role-Based Access Controls to 
enforce the principle of least privilege, successfully granting distinct "supervisor powers" 
and administrative tiers across the network. 
● GPO Troubleshooting: Intentionally broke Active Directory policies and forced update 
failures within the VMs to simulate real-world service disruptions, successfully 
troubleshooting and resolving the registry/policy blocks. 
● Bulk Deployment: Leveraged Group Policy Objects (GPOs) to deploy simultaneous 
remote software updates and configurations across all connected client endpoints 
post-remediation. 
● Documentation & Visibility: Logged simulated incidents in a local tracking system, 
detailing the root cause of the broken configurations and the step-by-step resolution path 
verified via GitHub project repositories. 
PROFESSIONAL EXPERIENCE Operations & Logistics Coordinator (Roadie & Spark) | 
Hotshot Hauling | Jan 2022 – Present 
● SLA Management: Independently managed high-volume, time-sensitive delivery 
operations, consistently meeting strict Service Level Agreements (SLAs) for arrival and 
completion windows under zero direct supervision. 
● Field Troubleshooting: Independently resolved mobile application and connectivity 
issues in the field, troubleshooting device sync errors and authentication drops to ensure 
uninterrupted delivery operations. 
● Incident Resolution: Communicated effectively with support dispatch and stakeholders 
via chat, email, and phone to resolve real-time routing anomalies, data discrepancies, 
and platform delivery issues. 
● Technical Adaptability: Balanced ongoing logistics operations as a part-time gig while 
dedicating 20+ hours a week to independent technology certifications, virtualization 
projects, and system administration training. 
Claims Specialist & Investigator | Allstate | May 2121 – Dec 2121 
● Incident Documentation: Meticulously documented high volumes of user interactions 
and case evidence within internal enterprise systems, maintaining a comprehensive, 
audit-ready data trail for every file. 
● Technical Translation: Diagnosed complex, high-stakes inquiries to determine policy 
resolutions, successfully translating intricate technical guidelines into plain, professional 
language for non-technical clients. 
● Escalation Pathing: Analyzed edge-case disputes and systematically routed complex, 
multi-tiered issues to specialized senior teams, ensuring files reached the correct 
resource with zero loss of context. 
Project Manager | Dry Patrol of Central Ohio (Permanent Franchise Closure) | Aug 2018 – 
Dec 2020 
● Crisis Operations: Led time-critical logistics and resource allocation for multiple 
concurrent property disaster restoration projects, ensuring strict adherence to safety 
timelines and deployment efficiency. 
● Stakeholder Communication: Managed direct communications with stressed property 
owners and field teams during critical operational phases, resolving high-friction 
escalations with professionalism and clarity. 
● Resource Coordination: Balanced project scheduling, equipment tracking, and 
franchise vendor timelines under intense pressure until operations successfully 
concluded due to permanent business closure. 
EDUCATION & CERTIFICATIONS 
● Google Cybersecurity Professional Certificate | Coursera (Focus on Networks, OS, 
and Support) 
● CompTIA A+ | In Progress 
● High School Diploma | Newark High School`,
      tailoredResumeText: `# MICHAEL BURSON
New Concord, OH | 740.755.0345 | Mburson99@gmail.com
LinkedIn: https://www.linkedin.com/in/mjburson | Portfolio: https://github.com/mburson99-arch/AD-splunk-lab

## PROFESSIONAL SUMMARY
Dedicated and adaptable professional with 5+ years of remote operational experience, now pivoting into IT Support. Leveraging a robust foundation in customer service, strict SLA management, and high-stakes incident resolution to deliver prompt and effective technical assistance. Proven hands-on IT infrastructure experience in Windows Server, Active Directory, GPO management, TCP/IP fundamentals, and VPN troubleshooting, developed through a self-hosted enterprise lab environment. Eager to contribute problem-solving skills and an energetic approach to ensure seamless technology operations and exceptional user support in a remote capacity.

## TECHNICAL SKILLS
*   **Operating Systems & Server Environments:** Windows Server/Client OS, Active Directory (ADUC), Group Policy Objects (GPOs), RBAC (Role-Based Access Control), Windows Server Administration
*   **Network & Connectivity Support:** VPN Configuration & Troubleshooting, DNS/DHCP Configuration, Remote Desktop Protocol (RDP), Multi-VM Architecture, TCP/IP Protocol Fundamentals, LAN/WAN Concepts (Virtualized), Basic Network Diagnostics (ping, tracert), Firewall Principles (e.g., Meraki familiarity)
*   **Help Desk & Service Management Concepts:** Enterprise Incident Simulation, SLA Management, Remote Software Deployment, Root-Cause Documentation, High-Pressure Communication, Incident Resolution, Incident Tracking & Resolution Documentation (e.g., ServiceNow, Jira principles), SCCM/GPO for Patch Management
*   **Hardware & Peripherals:** Mobile Device Troubleshooting, Remote Hardware Diagnostics & Support Principles (Desktops, Laptops, Mobile Devices, Printers, Peripherals)

## FEATURED TECHNICAL PROJECT
### Enterprise Service Desk & Identity Management Lab | Self-Hosted | Dec 2024 – Present
Engineered a virtualized sandbox environment to master Level 1 Helpdesk operations, Windows systems administration, and live infrastructure troubleshooting, directly simulating enterprise support scenarios.
*   **Multi-Platform Infrastructure:** Successfully built and networked a 4-Virtual Machine topology (including Windows Server) to simulate an enterprise Windows server-client environment, establishing foundational LAN/WAN concepts and TCP/IP connectivity.
*   **Access Control & Security:** Implemented Active Directory and Role-Based Access Controls to enforce the principle of least privilege, configuring distinct administrative tiers and user permissions across the network.
*   **Policy Management & Troubleshooting:** Deliberately introduced Active Directory policy failures and forced update disruptions to replicate real-world service incidents, successfully diagnosing and resolving registry/policy blocks.
*   **Remote Deployment & Updates:** Utilized Group Policy Objects (GPOs) for simultaneous remote software deployment, updates, and configuration across all connected client endpoints, mimicking enterprise patch management and deployment strategies (similar to SCCM functions).
*   **Incident Documentation:** Logged simulated incidents within a local tracking system, detailing root causes and step-by-step resolution paths, directly mirroring help desk ticketing system practices and preparing for platforms like ServiceNow or Jira.
*   **Network Component Configuration:** Configured and troubleshot DNS, DHCP, and VPN within the virtualized network, ensuring robust connectivity and resource access.
*   **Network Diagnostics:** Conducted basic network diagnostics within the virtual environment, verifying DNS configurations and troubleshooting connectivity issues between VMs using fundamental TCP/IP commands (e.g., ping, tracert).

## PROFESSIONAL EXPERIENCE
### Operations & Logistics Coordinator (Roadie & Spark) | Hotshot Hauling | Jan 2022 – Present
*   **Remote Service Level Adherence:** Independently managed high-volume, time-sensitive remote delivery operations, consistently meeting strict Service Level Agreements (SLAs) for arrival and completion under zero direct supervision.
*   **Field Hardware & Connectivity Troubleshooting:** Independently diagnosed and resolved mobile device application and connectivity issues in the field, troubleshooting device sync errors and authentication drops to ensure uninterrupted operations, demonstrating practical hardware and software problem-solving.
*   **Remote Incident Resolution:** Communicated effectively with support dispatch and stakeholders via chat, email, and phone to resolve real-time routing anomalies and platform delivery issues, demonstrating strong remote problem-solving and communication.
*   **Technical Upskilling:** Balanced ongoing logistics operations as a part-time role while dedicating 20+ hours weekly to independent technology certifications, virtualization projects, and system administration training.

### Claims Specialist & Investigator | Allstate | May 2121 – Dec 2021
*   **Comprehensive Incident Documentation:** Meticulously documented high volumes of user interactions and case evidence within internal enterprise systems, maintaining a comprehensive, audit-ready data trail for every file, akin to help desk incident logging.
*   **Technical Information Translation:** Diagnosed complex, high-stakes inquiries to determine policy resolutions, successfully translating intricate technical guidelines into plain, professional language for non-technical clients.
*   **Systematic Escalation Pathing:** Analyzed edge-case disputes and systematically routed complex, multi-tiered issues to specialized senior teams, ensuring files reached the correct resource with zero loss of context and efficient resolution.

### Project Manager | Dry Patrol of Central Ohio (Permanent Franchise Closure) | Aug 2018 – Dec 2020
*   **Crisis Operations Management:** Led time-critical logistics and resource allocation for multiple concurrent property disaster restoration projects, ensuring strict adherence to safety timelines and deployment efficiency under pressure.
*   **Stakeholder Communication:** Managed direct communications with stressed property owners and field teams during critical operational phases, resolving high-friction escalations with professionalism and clarity.
*   **Resource Coordination:** Balanced project scheduling, equipment tracking, and franchise vendor timelines under intense pressure until operations successfully concluded.

## EDUCATION & CERTIFICATIONS
*   Google Cybersecurity Professional Certificate | Coursera (Focus on Networks, OS, and Support)
*   CompTIA A+ | In Progress
*   High School Diploma | Newark High School`,
      critiqueMarkdown: `Your original resume, while containing valuable transferable skills, needed significant re-framing to present you as a viable candidate for an IT Support role, especially as a career changer. Here's the breakdown:

*   **Professional Summary:** The original summary was too generic. Phrases like 'transitioning into IT' are fine, but it lacked specific technical keywords and didn't immediately connect your 5 years of remote operational experience to the *needs of an IT department. It didn't articulate how your operational expertise would directly benefit an IT role.
*   **Technical Skills:** Listing soft skills here dilutes the impact of your hard technical skills. More importantly, the specific tools and technologies mentioned in the job description (e.g., ServiceNow, SCCM, Meraki, macOS/Linux) were either absent or only vaguely alluded to. 'Multi-VM Architecture' is better demonstrated in a project, not just a skill list.
*   **Featured Technical Project:** This was your strongest asset, but the original framing could have been more explicit about how it mimics enterprise environments and directly addresses IT support tasks. It didn't fully leverage the opportunity to showcase your hands-on experience as a direct answer to the job description's technical requirements.
*   **Professional Experience:** While your experience had excellent transferable skills (SLA management, field troubleshooting, incident resolution, documentation, technical translation, escalation), the descriptions often focused on the logistics/claims aspect rather than emphasizing the underlying process, problem-solving, and technical aptitude that would translate to IT. For instance, 'Field Troubleshooting' in your Operations role was described generally, not with the specific IT-centric language that would resonate with an IT manager. The 'Technical Adaptability' bullet was great but could have been integrated more seamlessly.
*   **Alignment with JD:** The original resume didn't proactively map your existing skills and lab work to the job description's explicit requirements (e.g., GPO for patch management, ServiceNow/Jira for ticketing, specific networking components, hardware troubleshooting). The absence of any mention or implication of macOS or Linux experience is a direct gap against the job description's call for support across multiple operating systems including Windows, macOS, and Linux. While you don't have this experience, the original resume didn't acknowledge it or present your Windows foundation as a learning platform.

**Regarding Relocation:** The job description explicitly states 'Work Location: Remote', therefore, relocation is not required.`,
      hasUnreadEmailUpdate: false,
      emailUpdateCount: 0
    },
    {
      id: "job-r6lswmn",
      title: "Technical Product Support Specialist II - job post",
      company: "Zoll Medical Corporation",
      url: "https://www.indeed.com/jobs?q=Help+Desk+Technician&l=remote&from=searchOnDesktopSerp&vjk=f7588def10452287",
      description: "Acute Care Technology\n\nWhy Join ZOLL?\n\nAt ZOLL Data Systems, we’re on a mission to save lives and improve clinical outcomes through advanced Enterprise and SaaS technology for EMS, hospital, and billing organizations. As a Technical Product Support Specialist II, you will handle more complex technical customer inquiries and provide advanced support for specific ZOLL enterprise products. You will manage issues with greater independence, using advanced troubleshooting skills and collaborating across teams or other departments when resolving multi-product or system-specific issues (e.g., DB, OS, Networking). This role includes contributing to the knowledge base and proactively analyzing technical trends to drive improvements in customer satisfaction\n\nWhat You'll Do\n\nManage advanced troubleshooting for assigned ZOLL enterprise products, using analytical skills to identify root causes of technical issues (e.g., DB, OS, Networking), adhering to ZDM for complete documentation in Salesforce.\n\nHandle complex technical issues independently, escalating only critical or unresolved problems to senior team members or CSO teams (e.g., Software Support, Implementation) or other departments (e.g., Product/R&D, SRE, IT App Hosting, Sales) as necessary, using Atlassian Jira Service Desk for handoffs.\n\nCollaborate with other CSO teams or departments to address technical issues that span across multiple products or systems, ensuring seamless cross-product support, using Microsoft Teams or Slack for resource navigation.\n\nContribute to the knowledge base, creating and updating articles with solutions to complex technical problems (KB Create) and sharing insights with the team, linking relevant KB articles (KM Linking %) in Salesforce and Atlassian Confluence.\n\nIdentify technical trends through customer case analysis, proposing preventative support initiatives to reduce recurring issues, swarming in collaboration channels to enhance reputation as a technical expert.\n\nTake a proactive approach by recognizing potential technical challenges and addressing them before they escalate, ensuring compliance with initial response and ANRD.\n\nCross-train on additional technical components within the suite (e.g., SQL Server, VMware), gaining a broader understanding of the ZOLL product ecosystem, using tools like Salesforce and Microsoft Teams.\n\nFacilitate incident management processes, coordinating team responses to ensure timely resolution of high-priority technical cases or outages and adherence to SLAs, using Atlassian Jira Service Desk and Microsoft Teams.\n\nOptimize hybrid meeting structures and remote team productivity guidelines, using virtual collaboration tools like Microsoft Teams, Slack, and LogMeIn Rescue to maintain technical service excellence.\n\nAdhere to customers’ preferred contact methods (e.g., Five9, email, LogMeIn Rescue) and monitor technical bugged cases in Pending Internal Status on a regular cadence, ensuring compliance with ANRD and resource engagement\n\nWhat Success Looks Like\n\nTimely, Responsive Support: Consistently meet or exceed response time goals (e.g., initial response and ANRD) while resolving moderately complex technical issues with speed and precision.\n\nHigh-Quality Documentation: Maintain accurate, detailed, and ZDM-aligned case notes in Salesforce that ensure clarity, enable effective handoffs, and support team-wide visibility.\n\nCustomer-Centric Communication: Adhere to customer-preferred contact methods and deliver proactive, personalized technical assistance through channels like Five9, email, or LogMeIn Rescue.\n\nCross-Team Navigation & Escalation: Efficiently route technical issues to the appropriate internal teams (e.g., R&D, SRE, Software Support) using Jira Service Desk and Teams, with appropriate severity classification.\n\nKnowledge & Collaboration Leadership: Drive improvements in KM metrics (e.g., KM Linking %, KB Create) by authoring high-quality content and actively supporting peers through swarming in Microsoft Teams and Slack.\n\nWhat You Bring\n\nExperience: 2–4 years in technical product or customer support, ideally in Enterprise and/or SaaS healthcare software.\n\n Advanced Technical Expertise: Strong working knowledge of enterprise software components—including SQL Server, networking, VMware, and operating systems—allowing for efficient, high-quality technical support and troubleshooting.\n\n Analytical Problem Solving: Proven ability to identify root causes of complex issues and deliver sustainable technical solutions, clearly documented using the ZOLL Diagnostic Method (ZDM) for rapid resolution and internal knowledge sharing.\n\nSoft Skills: Exceptional communication and documentation skills, solid problem-solving ability, and a customer-centric mindset.\n\nMindset & Values: Enthusiastic about helping others, thrives in a fast-paced environment, and brings curiosity and resilience to every challenge.\n\nEducation: High school diploma required; a bachelor’s degree or equivalent professional experience is preferred.\n\nWhat We Offer\n\nRemote flexibility or the option to work from our Colorado HQ\n\nA collaborative, mission-driven work environment\n\nOpportunities for growth, mentorship, and career development\n\nCompetitive compensation and benefits\n\nThe pay range for this position is $18-$28 / hourly. Final compensation will be determined by various factors such as a candidate’s relevant work experience, skills, certifications, and location.\n\nApply Today\n\nIf you’re passionate about making a difference and delivering support that saves lives, we want to hear from you. Join us and help ensure the tools used in critical care never fail the people who rely on them.\n\n\nPhysical Demands\n\nThe physical demands described here are representative of those that must be met by an employee to successfully perform the essential functions of this job.\n\nStanding - Occasionally\n\nWalking - Occasionally\n\nSitting - Constantly\n\nTalking - Occasionally\n\nHearing - Occasionally\n\nRepetitive Motions - Frequently\n\n\nZOLL is a fast-growing company that operates in more than 140 countries around the world. Our employees are inspired by a commitment to make a difference in patients's lives, and our culture values innovation, self-motivation and an entrepreneurial spirit. Join us in our efforts to improve outcomes for underserved patients suffering from critical cardiopulmonary conditions and help save more lives.\n\n#LI-REMOTE\n\n#LI-HM1\n\nThe hourly pay rate for this position is:\n\n$18.00 to $28.00\n\nFactors which may affect this rate include shift, geography, skills, education, experience, and other qualifications of the successful candidate. Details of ZOLL's comprehensive benefits plans can be found at www.zollbenefits.com.\n\nApplications will be accepted on an ongoing basis until this position is filled. For fully remote positions, compensation will comply with all applicable federal, state, and local wage laws, including minimum wage requirements, based on the employee’s primary work location.\n\nAll qualified applicants will receive consideration for employment without regard to race, color, religion, sex, sexual orientation, gender identity, disability, or status as a protected veteran.\n\nADA: The employer will make reasonable accommodations in compliance with the Americans with Disabilities Act of 1990.",
      dateCaptured: "2026-05-26T13:18:24.735Z",
      status: "captured",
      hasUnreadEmailUpdate: false,
      emailUpdateCount: 0
    }
  ]);
}

if (!fs.existsSync(EMAILS_FILE)) {
  writeJSONFile(EMAILS_FILE, [
    {
      id: "email-1",
      jobId: "job-r6lswmn",
      jobTitle: "Technical Product Support Specialist II - job post",
      company: "Zoll Medical Corporation",
      senderName: "Zoll Data Systems HR team",
      timestamp: "2026-05-26T14:15:00.000Z",
      subject: "Candidacy Update: Technical Support Specialist II",
      body: `Hi Michael,\n\nThank you for submitting your tailored resume for the Technical Product Support Specialist II opening. We noticed your robust hands-on virtualized enterprise lab project and found your remote SLA and customer handling skills highly applicable to this position.\n\nCould you please let us know your availability for a brief 15-minute phone screening with our support team lead this coming Thursday or Friday?\n\nBest regards,\nEleanor Vance\nCSO Talent Acquisition Team\nZoll Medical Corporation`,
      type: "interview",
      isRead: false,
    },
    {
      id: "email-2",
      jobId: "job-9xfrz5y",
      jobTitle: "IT Support Specialist - job post",
      company: "Mercer Bucks Technology",
      senderName: "Mercer Bucks Careers",
      timestamp: "2026-05-26T05:30:00.000Z",
      subject: "Application Confirmed: IT Support Specialist (Remote)",
      body: `Hi Michael Burson,\n\nThis automatic notification is to confirm that we have successfully received your tailored application for the IT Support Specialist role.\n\nOur service division is currently routing applications for manual review. We will contact you directly if there is an alignment with our Meraki networking and SCCM operational workflows.\n\nKind regards,\nRecruitment Desk\nMercer Bucks Technology`,
      type: "received",
      isRead: false,
    }
  ]);
}

if (!fs.existsSync(LOGS_FILE)) {
  writeJSONFile(LOGS_FILE, [
    {
      id: "log-1",
      timestamp: "2026-05-26T00:01:00Z",
      sender: "SYSTEM",
      text: "JobFlow automated pipeline watcher initialized.",
    },
    {
      id: "log-2",
      timestamp: "2026-05-26T00:02:10Z",
      sender: "SYSTEM",
      text: "Active capture modules: Indeed, LinkedIn Extension integrations active.",
    }
  ]);
}

const VALID_JOB_STATUSES = new Set(["captured", "analyzing", "tailored", "manual_review", "submitted", "denied", "interviewing"]);

function normalizeJobPayload(body: any, options: { defaultUrl: string; defaultDescription: string; dateField?: "date" | "dateCaptured" }) {
  const status = VALID_JOB_STATUSES.has(body.status) ? body.status : "captured";
  const dateValue = options.dateField === "date" ? body.date : body.dateCaptured;

  return {
    id: body.id || "job-" + Math.random().toString(36).substring(2, 9),
    title: String(body.title || "").trim(),
    company: String(body.company || "").trim(),
    url: body.url || options.defaultUrl,
    description: body.description || options.defaultDescription,
    dateCaptured: dateValue || new Date().toISOString(),
    status,
    matchScore: typeof body.matchScore === "number" ? body.matchScore : undefined,
    originalResume: body.originalResume || undefined,
    tailoredResumeText: body.tailoredResumeText || undefined,
    critiqueMarkdown: body.critiqueMarkdown || undefined,
    hasUnreadEmailUpdate: Boolean(body.hasUnreadEmailUpdate),
    emailUpdateCount: Number(body.emailUpdateCount || 0),
    requiresRelocation: typeof body.requiresRelocation === "boolean" ? body.requiresRelocation : undefined,
    aiResponse: body.aiResponse || undefined,
  };
}

function upsertJobFromPayload(body: any, options: { defaultUrl: string; defaultDescription: string; dateField?: "date" | "dateCaptured" }) {
  const incomingJob = normalizeJobPayload(body, options);
  const jobs = readJSONFile<any[]>(JOBS_FILE, []);

  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  if (incomingJob.id && deletedIds.includes(incomingJob.id)) {
    writeJSONFile(DELETED_JOBS_FILE, deletedIds.filter((id) => id !== incomingJob.id));
  }

  const existingIdx = jobs.findIndex((job) =>
    (incomingJob.id && job.id === incomingJob.id) ||
    (job.title === incomingJob.title && job.company === incomingJob.company)
  );

  if (existingIdx !== -1) {
    jobs[existingIdx] = {
      ...jobs[existingIdx],
      ...incomingJob,
      id: jobs[existingIdx].id,
      hasUnreadEmailUpdate: jobs[existingIdx].hasUnreadEmailUpdate || incomingJob.hasUnreadEmailUpdate,
      emailUpdateCount: jobs[existingIdx].emailUpdateCount || incomingJob.emailUpdateCount,
    };
    writeJSONFile(JOBS_FILE, jobs);
    return { job: jobs[existingIdx], created: false };
  }

  jobs.push(incomingJob);
  writeJSONFile(JOBS_FILE, jobs);
  return { job: incomingJob, created: true };
}

// REST APIs
app.get("/api/auth/config", (_req, res) => {
  res.json({
    clientId: googleClientId,
    configured: Boolean(googleClientId),
  });
});

// 1. Get entire Job Pipeline
app.get("/api/jobs", (req, res) => {
  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  const filteredJobs = jobs.filter((j) => !deletedIds.includes(j.id));
  res.json(filteredJobs);
});

// 2. Add manual job entry or chrome extension scraping
app.post("/api/jobs", (req, res) => {
  const { title, company } = req.body;
  if (!title || !company) {
    return res.status(400).json({ error: "Job Title and Company are required." });
  }

  const { job, created } = upsertJobFromPayload(req.body, {
    defaultUrl: "",
    defaultDescription: "No description provided.",
    dateField: "dateCaptured",
  });

  if (created) {
    addLog("CHROME", `Captured job: "${job.title}" at ${job.company}.`);
  }
  res.status(created ? 201 : 200).json(job);
});

// Endpoint dedicated for Chrome extension / Scraping mock receiver
app.post("/api/jobs/scrape", (req, res) => {
  const { title, company } = req.body;
  if (!title || !company) {
    return res.status(400).json({ error: "Missing title or company in captured content." });
  }

  const { job, created } = upsertJobFromPayload(req.body, {
    defaultUrl: "LinkedIn / Indeed Captured Link",
    defaultDescription: "No description matched by content script.",
    dateField: "date",
  });

  if (created) {
    addLog("CHROME", `Extension captured "${job.title}" at ${job.company}.`);
  }
  res.status(created ? 201 : 200).json(job);
});

// Delete a job
app.delete("/api/jobs/:id", (req, res) => {
  const { id } = req.params;
  let jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const exists = jobs.some((j) => j.id === id);
  if (!exists) {
    return res.status(404).json({ error: "Job not found." });
  }

  // We do NOT physically delete the job details so it can be restored from the UI Deleted list
  // The job will be filtered out of active views since its ID is added to DELETED_JOBS_FILE tombstones

  // Mark in server-side deleted tombstones list
  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  if (!deletedIds.includes(id)) {
    deletedIds.push(id);
    writeJSONFile(DELETED_JOBS_FILE, deletedIds);
  }

  addLog("SYSTEM", `Moved job index entry ${id} to deleted archive pipeline.`);
  res.json({ success: true });
});

// Get deleted jobs
app.get("/api/jobs/deleted", (req, res) => {
  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  const deletedJobs = jobs.filter((j) => deletedIds.includes(j.id));
  res.json(deletedJobs);
});

// Restore a job from deleted tombstones
app.post("/api/jobs/:id/restore", (req, res) => {
  const { id } = req.params;
  const deletedIds = readJSONFile<string[]>(DELETED_JOBS_FILE, []);
  const exists = deletedIds.includes(id);
  if (!exists) {
    return res.status(404).json({ error: "Job tombstone not found in database." });
  }

  const updatedDeleted = deletedIds.filter((d) => d !== id);
  writeJSONFile(DELETED_JOBS_FILE, updatedDeleted);

  addLog("SYSTEM", `Restored job entry ${id} back to active pipeline.`);
  res.json({ success: true });
});

// Update status of job
app.post("/api/jobs/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!VALID_JOB_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid job status." });
  }

  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const idx = jobs.findIndex((j) => j.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Job listing not found." });
  }

  jobs[idx].status = status;
  if (status === "submitted") {
    jobs[idx].hasUnreadEmailUpdate = false;
  }
  writeJSONFile(JOBS_FILE, jobs);
  addLog("SYSTEM", `Status of "${jobs[idx].title}" shifted to [${status.toUpperCase()}].`);
  res.json(jobs[idx]);
});

// Clear email alert flags manually
app.post("/api/jobs/:id/clear-alert", (req, res) => {
  const { id } = req.params;
  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const idx = jobs.findIndex((j) => j.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Job listings index not found." });
  }

  jobs[idx].hasUnreadEmailUpdate = false;
  jobs[idx].emailUpdateCount = 0;
  writeJSONFile(JOBS_FILE, jobs);

  // Also read and mark related emails as read
  const emails = readJSONFile<any[]>(EMAILS_FILE, []);
  emails.forEach((e) => {
    if (e.jobId === id) {
      e.isRead = true;
    }
  });
  writeJSONFile(EMAILS_FILE, emails);

  addLog("SYSTEM", `Cleared response flags for "${jobs[idx].title}".`);
  res.json(jobs[idx]);
});

// 3. Profiles Endpoint (Resume text)
app.get("/api/profile", (req, res) => {
  const profile = readJSONFile<any>(PROFILE_FILE, {});
  res.json(profile);
});

app.post("/api/profile", (req, res) => {
  const { name, email, phone, website, resumeText } = req.body;
  const profile = { name, email, phone, website, resumeText };
  writeJSONFile(PROFILE_FILE, profile);
  addLog("SYSTEM", "Default candidate profile and base resume parsed & updated.");
  res.json(profile);
});

// Endpoint to download the entire system as a customized .zip package
app.get("/api/export/download-zip", (req, res) => {
  addLog("SYSTEM", "User requested direct desktop application ZIP download.");
  try {
    const zip = new AdmZip();

    // 1. Add top level files
    const rootFiles = [
      "package.json",
      "tsconfig.json",
      "vite.config.ts",
      "index.html",
      "server.ts",
      "Run-JobFlow-Windows.bat",
      "Run-JobFlow-MacLinux.sh",
      "LOCAL-SETUP.md",
      ".env.example",
      ".gitignore"
    ];

    rootFiles.forEach((file) => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
      }
    });

    // 2. Add local databases so user's progress carries over perfectly
    const dbFiles = [
      "jobs_db.json",
      "emails_db.json",
      "profile_db.json",
      "logs_db.json"
    ];

    dbFiles.forEach((file) => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
      }
    });

    // 3. Add entire src folder recursively (excluding node_modules or dist)
    const srcPath = path.join(process.cwd(), "src");
    if (fs.existsSync(srcPath)) {
      zip.addLocalFolder(srcPath, "src");
    }

    const zipBuffer = zip.toBuffer();
    
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="JobFlow-Standalone-Suite.zip"');
    res.send(zipBuffer);
  } catch (error) {
    console.error("ZIP Generation failed:", error);
    addLog("SYSTEM", "Error: Offline PC Application ZIP assembly failed.");
    res.status(500).json({ error: "Failed to generate stand-alone ZIP package folder." });
  }
});

// 4. Gemini Tailorer API - Brutally Nitpick & Tailor
app.post("/api/resume/tailor", async (req, res) => {
  const { jobId, resumeText, jobDescription, customInstructions, currentDraft } = req.body;
  if (!jobId || !resumeText || !jobDescription) {
    return res.status(400).json({ error: "Job ID, Resume, and Job Description are required." });
  }

  const profile = readJSONFile<any>(PROFILE_FILE, {
    name: "Michael Burson",
    email: "mburson99@gmail.com",
    phone: "740.755.0345",
    website: "https://github.com/mburson99-arch",
  });

  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const jobIdx = jobs.findIndex((j) => j.id === jobId);
  if (jobIdx === -1) {
    return res.status(404).json({ error: "Associated job not found in pipeline database." });
  }

  jobs[jobIdx].status = "analyzing";
  writeJSONFile(JOBS_FILE, jobs);

  addLog("SYSTEM", `Running resume analyzer on "${jobs[jobIdx].title}" at ${jobs[jobIdx].company}.`);
  addLog("PROMPT", `Prompting: "Take this resume and job description and tailor the resume for this job while being brutally honest and nit picking where needs be..."`);

  try {
    let tailoredResult: any;

    if (ai) {
      let customParamText = "";
      if (customInstructions) {
        if (currentDraft && currentDraft.trim() !== "") {
           customParamText = `
USER HAS PROVIDED ADDITIONAL REFINEMENT INSTRUCTIONS FOR THE CURRENT DRAFT:
"${customInstructions}"

Current Draft Resume that you generated previously:
"""
${currentDraft}
"""

Please apply these refinement instructions to the Current Draft Resume, while ensuring you adhere to all original rules (keeping it honest, highlighting transferable skills). Answer the user's instructions conversationally in the "aiResponse" field.
`;
        } else {
           customParamText = `\n\nUSER HAS PROVIDED ADDITIONAL REFINEMENT INSTRUCTIONS: \n"${customInstructions}"\nApply these instructions strictly to the generated tailoredResume.\n`;
        }
      }

      // Prompt specification matches exact instructions from the user:
      const currentDateString = new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const userPrompt = `
You are an expert technical recruiter, executive headhunter, and resume architect. You are known for your brutal honesty and clinical precision. Your goal is to rewrite the candidate's resume to match the job description perfectly, while critiqueing their current formulation with unmatched transparency to maximize job retention and hiring callbacks.

CANDIDATE CONTACT DETAILS (YOU MUST EXCLUSIVELY KEEP THESE EXACT CONTACT DETAILS UNCHANGED IN YOUR FINAL TAILORED RESUME OUTPUT AND NEVER FABRICATE ANY FAKE MOBILE NUMBERS, EMAILS, WEBSITES, OR DIGITAL ADDRESSES):
- Name: ${profile.name || "Michael Burson"}
- Mobile Number: ${profile.phone || "740.755.0345"}
- Primary Email: ${profile.email || "mburson99@gmail.com"}
- Portfolio/Github: ${profile.website || "https://github.com/mburson99-arch"}
- LinkedIn Portfolio Link: https://linkedin.com/in/michaelburson

IMPORTANT CONTEXT: Today's current date is ${currentDateString}. The current year is ${new Date().getFullYear()}. Any time calculation or date reference you make MUST reflect the current year. Ensure the candidate's present roles remain "Present", do not incorrectly set them to end in the past.

Original Base Resume:
"""
${resumeText}
"""

Job Description:
"""
${jobDescription}
"""

Instructions:
Take this resume and job description and tailor the resume for this job while being brutally honest and nit picking where needs be for the highest success rate at job retention and callback from future employer prospects.

I am pivoting my career from 5 years of remote operations, logistics, and claims management into my first IT Support/Help Desk role. I need you to tailor my base resume to fit the specific job description provided.

Here are my strict rules for this rewrite:

1. Keep it Human: Do not use overly robotic, flowery, or cliché AI terminology (e.g., avoid words like 'spearheaded,' 'synergized,' 'visionary,' or 'unparalleled'). Use a formal, professional, yet grounded tone that sounds like a real, hardworking person.
2. Honesty is Key: Do not stretch the truth, fabricate metrics, or invent enterprise IT experience I do not have. I want to be entirely open about my background.
3. Focus on the Pivot: Frame my work history honestly: I am a career changer armed with highly transferable soft skills, including strict SLA management, high-stakes client de-escalation, and field troubleshooting.
4. Highlight My Practical Tech Skills: Emphasize my hands-on technical foundation through my Self-Hosted Enterprise Service Desk Lab, Active Directory/RBAC experience, and my current active studies for my CompTIA A+ certification.
5. Tailor to the JD: Carefully read the provided job description. Rearrange my bullet points and highlight the specific transferable skills and lab projects from my base resume that directly answer the employer's requirements.
6. Absolute Contact Integrity: Under no conditions should you alter or replace the candidate's real name (${profile.name || "Michael Burson"}), phone (${profile.phone || "740.755.0345"}), email (${profile.email || "mburson99@gmail.com"}), portfolio website (${profile.website || "https://github.com/mburson99-arch"}), or LinkedIn link (https://linkedin.com/in/michaelburson). Keep them exactly identical in the header of the tailored document.
${customParamText}

You MUST respond strictly in a valid JSON format with the following keys:
1. "brutallyHonestCritique": Provide a detailed, transparent, and direct critique of the original resume. Point out exactly where they sound junior, where their skills are lacking compared to the job description, where their descriptions lack impact, and how they failed to describe their actual depth. Speak frankly and professionally ("brutally honest"). Use Markdown. Include in this critique a prominent note if the job explicitly requires relocation based on the JD.
2. "tailoredResume": A complete, expertly formatted Markdown version of the tailored resume. YOU MUST USE EXACT MARKDOWN HEADERS (# Name, ## PROFESSIONAL SUMMARY, ## TECHNICAL SKILLS, ## EXPERIENCE) for all sections. DO NOT just bold section names. The lack of standard ## headers ruins the format. Follow the pivot instructions strictly. Avoid plain-text 1990s aesthetics. IMPORTANT FOR LINKS: NEVER hide URLs behind Markdown text links (e.g., do NOT use \`[LinkedIn](https://linkedin.com/...)\`). Always write out the full URL so it remains fully visible to the reader (e.g., \`LinkedIn: https://linkedin.com/...\`). The raw URLs MUST be visible in the text so recruiters viewing the printed PDF can read them.
3. "matchScore": An estimated match score percentage (integer between 0 and 100) based on alignment with the JD after styling.
4. "suggestedSkills": A string array of top crucial technical skills that were highlighted or added to alignment.
5. "estimatedMatchExplanation": A brief 1-2 sentence explanation of why the tailored resume will successfully pass ATS systems and recruiters.
6. "requiresRelocation": A boolean indicating if the job description specifically states that relocation is required or expected.
7. "aiResponse": A conversational response directed to the user acknowledging their custom instructions, answering any questions they asked in the custom instructions, and explaining the specific changes made based on their request. If no custom instructions were given, just leave empty or provide a very short introductory statement.

DO NOT output any wrapping markdown or text other than the valid parseable JSON. Ensure all quotes are escaped properly.
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brutallyHonestCritique: { type: Type.STRING },
              tailoredResume: { type: Type.STRING },
              matchScore: { type: Type.INTEGER },
              suggestedSkills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              estimatedMatchExplanation: { type: Type.STRING },
              requiresRelocation: { type: Type.BOOLEAN },
              aiResponse: { type: Type.STRING },
            },
            required: ["brutallyHonestCritique", "tailoredResume", "matchScore", "suggestedSkills", "estimatedMatchExplanation", "requiresRelocation", "aiResponse"],
          },
        },
      });

      const responseText = response.text ? response.text.trim() : "";
      tailoredResult = JSON.parse(responseText);
    } else if (!tailoredResult) {
      // No-key fallback keeps user data intact instead of fabricating experience.
      console.log("No Gemini API key found; returning original resume without AI edits.");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      tailoredResult = {
        brutallyHonestCritique: "### Tailoring unavailable\n\nGemini is not configured, so the app did not rewrite your resume. Add a valid GEMINI_API_KEY to run the tailoring workflow.",
        tailoredResume: resumeText,
        matchScore: 0,
        suggestedSkills: [],
        estimatedMatchExplanation: "No AI match estimate was generated because Gemini is not configured.",
        requiresRelocation: false,
        aiResponse: "I preserved your original resume because no AI provider is configured.",
      };
    }

    // Update job pipeline
    const jobsRef = readJSONFile<any[]>(JOBS_FILE, []);
    const refIdx = jobsRef.findIndex((j) => j.id === jobId);
    if (refIdx !== -1) {
      jobsRef[refIdx].status = "tailored";
      jobsRef[refIdx].matchScore = tailoredResult.matchScore;
      jobsRef[refIdx].originalResume = resumeText;
      jobsRef[refIdx].tailoredResumeText = tailoredResult.tailoredResume;
      jobsRef[refIdx].critiqueMarkdown = tailoredResult.brutallyHonestCritique;
      jobsRef[refIdx].requiresRelocation = tailoredResult.requiresRelocation;
      jobsRef[refIdx].aiResponse = tailoredResult.aiResponse;
      writeJSONFile(JOBS_FILE, jobsRef);
    }

    addLog("LLM", `Tailored successfully using gemini-2.5-flash. Estimated match score: ${tailoredResult.matchScore}%.`);
    addLog("SYSTEM", `Automated resume file preview ready for: "Tailored resume for ${jobs[jobIdx].title} at ${jobs[jobIdx].company}.txt".`);

    res.json({ success: true, ...tailoredResult });
  } catch (error: any) {
    console.error("Error tailoring resume:", error);
    const jobsRef = readJSONFile<any[]>(JOBS_FILE, []);
    const refIdx = jobsRef.findIndex((j) => j.id === jobId);
    if (refIdx !== -1) {
      jobsRef[refIdx].status = "captured";
      writeJSONFile(JOBS_FILE, jobsRef);
    }
    addLog("SYSTEM", `Failed during Gemini Prompt tailoring sequence: ${error.message || error}`);
    res.status(500).json({ error: error.message || "Failed during resume tailoring process." });
  }
});

// 4.5 Gemini Keyword Search API
app.post("/api/keywords/search", async (req, res) => {
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: "Query is required for keyword generation." });
  }

  addLog("SYSTEM", `Running Gemini to generate job search keywords for query: "${query}"`);
  addLog("PROMPT", `Prompting: "Generate search keywords and boolean string for ${query}..."`);

  try {
    let result: any;

    if (ai) {
      const userPrompt = `
You are an expert recruiter and career coach. The user is searching for jobs but might not know the exact titles or terminology.
Provide a list of highly effective keywords, related job titles, and a few boolean search strings they can use on Indeed, LinkedIn, or Google based on their description.

User's Query: "${query}"

Return the response STRICTLY as a valid JSON object with the following keys:
1. "coreKeywords": A string array of 5-8 primary skills or keywords to search for.
2. "relatedTitles": A string array of 3-5 alternative job titles they should search for.
3. "booleanStrings": A string array of 2-3 boolean search strings (e.g., "(Title A OR Title B) AND (Skill C OR Skill D)").
4. "advice": A conversational, helpful 1-2 sentence tip on how to best search and filter these jobs based on their query.
`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: userPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                coreKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                relatedTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
                booleanStrings: { type: Type.ARRAY, items: { type: Type.STRING } },
                advice: { type: Type.STRING },
              },
              required: ["coreKeywords", "relatedTitles", "booleanStrings", "advice"],
            },
          },
        });

        const responseText = response.text || "{}";
        result = JSON.parse(responseText);
      } catch (aiError: any) {
        console.error("Gemini API error, falling back to mock:", aiError?.message || aiError);
        // Fallback to mock result if API is overloaded (e.g. 503)
        result = {
          coreKeywords: ["skill 1", "skill 2", "skill 3", "helpdesk"],
          relatedTitles: ["IT Support Specialist", "System Administrator", "Desktop Support"],
          booleanStrings: [`("IT Support" OR "Helpdesk") AND ("Active Directory" OR "Networking")`],
          advice: "The AI service is currently busy (503). Using these fallback boolean strings in LinkedIn's search bar to narrow down roles related to your query.",
        };
      }
    } else if (!result) {
      // Mock result if AI is not configured
      result = {
        coreKeywords: ["skill 1", "skill 2", "skill 3", "helpdesk"],
        relatedTitles: ["IT Support Specialist", "System Administrator", "Desktop Support"],
        booleanStrings: [`("IT Support" OR "Helpdesk") AND ("Active Directory" OR "Networking")`],
        advice: "Use these boolean strings in LinkedIn's search bar to narrow down roles related to your query.",
      };
    }

    addLog("LLM", `Generated keywords and search phrases for: ${query}`);
    
    res.json(result);
  } catch (error: any) {
    console.error("Error generating keywords:", error);
    addLog("SYSTEM", `Failed to generate keywords: ${error.message || error}`);
    res.status(500).json({ error: error.message || "Failed to generate keywords." });
  }
});

// 5. Simulated Incoming Email Trigger API (Manual or timed simulation)
app.post("/api/jobs/:id/simulate-email", (req, res) => {
  const { id } = req.params;
  const { subject, body, type, sender } = req.body;

  const jobs = readJSONFile<any[]>(JOBS_FILE, []);
  const job = jobs.find((j) => j.id === id);
  if (!job) {
    return res.status(404).json({ error: "Job corresponding index not found." });
  }

  // Set the job unread reply indicator to true
  job.hasUnreadEmailUpdate = true;
  job.emailUpdateCount = (job.emailUpdateCount || 0) + 1;
  writeJSONFile(JOBS_FILE, jobs);

  // Generate Email Alert
  const emails = readJSONFile<any[]>(EMAILS_FILE, []);
  const newEmail = {
    id: "email-" + Math.random().toString(36).substring(2, 9),
    jobId: id,
    jobTitle: job.title,
    company: job.company,
    senderName: sender || `Recruitment Team (${job.company})`,
    timestamp: new Date().toISOString(),
    subject: subject || `Next steps: your application at ${job.company}`,
    body: body || `Dear Alex,\n\nThank you for submitting your tailored resume. We would love to move you to an interview block.\n\nBest wishes,\nRecruiting at ${job.company}`,
    type: type || "interview",
    isRead: false,
  };

  emails.push(newEmail);
  writeJSONFile(EMAILS_FILE, emails);

  addLog("SYSTEM", `[ALERT] New email received from ${job.company} with update indicators!`);
  res.json({ email: newEmail, job });
});

// List simulated emails
app.get("/api/emails", (req, res) => {
  const emails = readJSONFile<any[]>(EMAILS_FILE, []);
  res.json(emails);
});

// Mark email as read
app.post("/api/emails/:id/read", (req, res) => {
  const { id } = req.params;
  const emails = readJSONFile<any[]>(EMAILS_FILE, []);
  const idx = emails.findIndex((e) => e.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: "Email Alert not found." });
  }

  emails[idx].isRead = true;
  writeJSONFile(EMAILS_FILE, emails);

  // Check if there are other unread emails for the same job
  const jobId = emails[idx].jobId;
  const hasMoreUnread = emails.some((e) => e.jobId === jobId && !e.isRead);

  if (!hasMoreUnread) {
    const jobs = readJSONFile<any[]>(JOBS_FILE, []);
    const jobIdx = jobs.findIndex((j) => j.id === jobId);
    if (jobIdx !== -1) {
      jobs[jobIdx].hasUnreadEmailUpdate = false;
      jobs[jobIdx].emailUpdateCount = 0;
      writeJSONFile(JOBS_FILE, jobs);
    }
  }

  res.json(emails[idx]);
});

// Reset database to initial demo state
app.post("/api/jobs/reset", (req, res) => {
  const defaultJobs = [
    {
      id: "job-9xfrz5y",
      title: "IT Support Specialist - job post",
      company: "Mercer Bucks Technology",
      url: "https://www.indeed.com/jobs?q=it+support&l=Remote&radius=25&from=searchOnDesktopSerp%2Cwhereautocomplete&vjk=13a1127297189f0e",
      description: "Job Overview\nWe are seeking a dynamic and motivated IT Support Specialist to join our technology team! In this role, you will be the frontline hero for resolving technical issues, supporting users across various platforms, and maintaining our IT infrastructure. Your energetic approach and problem-solving skills will ensure seamless technology operations, empowering our organization to achieve its goals efficiently. This paid position offers an exciting opportunity to develop your expertise in a fast-paced, innovative environment while delivering exceptional customer service and technical support.\n\nResponsibilities\n\nProvide prompt and effective technical support to end-users via help desk tickets, phone, or in-person interactions.\nTroubleshoot software issues across multiple operating systems including Windows, macOS, and Linux, ensuring quick resolution.\nManage computer hardware components such as desktops, laptops, mobile devices, printers, and peripherals to optimize performance.\nSupport network administration tasks including configuring and maintaining LAN (Local Area Network), WAN (Wide Area Network), VPN (Virtual Private Network), DNS (Domain Name System), and firewall settings like Meraki devices.\nAssistant with software deployment, updates, and patch management using tools such as SCCM (System Center Configuration Manager) and GPO (Group Policy Objects).\nMonitor and maintain IT infrastructure components including Windows Server environments, Active Directory, TCP/IP protocols, and network security measures.\nUtilize service management tools like ServiceNow, Jira, BMC Remedy, or similar platforms for incident tracking and resolution documentation.\nCollaborate with team members on network administration tasks including TCP/UDP analysis, DNS configuration, and troubleshooting connectivity issues.\nSupport remote users by configuring VPN access and troubleshooting connectivity problems on mobile devices and laptops.\n\nRequirements\n\nProven experience providing technical support in a fast-paced environment with excellent customer service skills.\nStrong troubleshooting skills across software applications and hardware components.\nHands-on experience managing computer networks including LAN/WAN setup, TCP/IP protocols, DNS configuration, firewalls (e.g., Meraki), and VPNs.\nFamiliarity with operating systems such as Windows (including Windows Server), macOS, and Linux distributions.\nKnowledge of IT support tools like SCCM for software deployment and GPO for policy management.\nExperience with help desk ticketing systems such as ServiceNow or BMC Remedy is highly desirable.\nAbility to communicate complex technical information clearly to non-technical users.\nAnalysis skills to diagnose issues quickly and implement effective solutions efficiently. Join us to be part of a vibrant team dedicated to leveraging technology to drive success! Your expertise will help create a resilient IT environment that supports innovation while delivering outstanding service to all users.\n\nPay: $26.45 - $31.85 per hour\n\nBenefits:\n\nDental insurance\nPaid time off\n\nWork Location: Remote",
      dateCaptured: new Date().toISOString(),
      status: "submitted",
      matchScore: 78,
      originalResume: "MICHAEL BURSON New Concord, OH | 740.755.0345 | Mburson99@gmail.com LinkedIn: \nwww.linkedin.com/in/mjburson | Portfolio: github.com/mburson99-arch/AD-splunk-lab \nPROFESSIONAL SUMMARY Disciplined, customer-focused professional with over 5 years of \nremote operational experience transitioning into IT. Proven expertise managing strict SLAs, \nhandling high-stakes client escalations, and maintaining productivity in self-directed \nenvironments. Armed with practical IT infrastructure expertise in Windows OS, Active Directory \n(Password Resets/Unlocks), and VPN troubleshooting built through enterprise simulations. \nReady to provide first-line support to enterprise employees and ensure minimal downtime. \nTECHNICAL SKILLS \n● Systems Administration: Active Directory (ADUC), Group Policy Objects (GPOs), \nRBAC (Role-Based Access Control), Windows Server/Client OS \n● Network & Security Support: Multi-VM Architecture, VPN Troubleshooting, DNS/DHCP \nConfiguration, Remote Desktop Protocol (RDP) \n● Operations & Diagnostics: Enterprise Incident Simulation, SLA Management, Remote \nSoftware Deployment, Root-Cause Documentation \n● Soft Skills: High-Pressure Communication, Incident Resolution, Technical Translation, \nTeam Collaboration \nFEATURED TECHNICAL PROJECT Enterprise Service Desk & Identity Management Lab | \nSelf-Hosted | Dec 2024 – Present Engineered a virtualized sandbox environment to master \nLevel 1 Helpdesk operations, systems administration, and live infrastructure troubleshooting. \n● Multi-VM Architecture: Successfully built and networked a 4-Virtual Machine topology \nto run in tandem, simulating an enterprise server-client environment on the first iteration. \n● Access Control & RBAC: Created users and applied Role-Based Access Controls to \nenforce the principle of least privilege, successfully granting distinct \"supervisor powers\" \nand administrative tiers across the network. \n● GPO Troubleshooting: Intentionally broke Active Directory policies and forced update \nfailures within the VMs to simulate real-world service disruptions, successfully \ntroubleshooting and resolving the registry/policy blocks. \n● Bulk Deployment: Leveraged Group Policy Objects (GPOs) to deploy simultaneous \nremote software updates and configurations across all connected client endpoints \npost-remediation. \n● Documentation & Visibility: Logged simulated incidents in a local tracking system, \ndetailing the root cause of the broken configurations and the step-by-step resolution path \nverified via GitHub project repositories. \nPROFESSIONAL EXPERIENCE Operations & Logistics Coordinator (Roadie & Spark) | \nHotshot Hauling | Jan 2022 – Present \n● SLA Management: Independently managed high-volume, time-sensitive delivery \noperations, consistently meeting strict Service Level Agreements (SLAs) for arrival and \ncompletion windows under zero direct supervision. \n● Field Troubleshooting: Independently resolved mobile application and connectivity \nissues in the field, troubleshooting device sync errors and authentication drops to ensure \nuninterrupted delivery operations. \n● Incident Resolution: Communicated effectively with support dispatch and stakeholders \nvia chat, email, and phone to resolve real-time routing anomalies, data discrepancies, \nand platform delivery issues. \n● Technical Adaptability: Balanced ongoing logistics operations as a part-time gig while \ndedicating 20+ hours a week to independent technology certifications, virtualization \nprojects, and system administration training. \nClaims Specialist & Investigator | Allstate | May 2121 – Dec 2021 \n● Incident Documentation: Meticulously documented high volumes of user interactions \nand case evidence within internal enterprise systems, maintaining a comprehensive, \naudit-ready data trail for every file. \n● Technical Translation: Diagnosed complex, high-stakes inquiries to determine policy \nresolutions, successfully translating intricate technical guidelines into plain, professional \nlanguage for non-technical clients. \n● Escalation Pathing: Meticulously route complex, multi-tiered issues to specialized senior teams, ensuring files reached the correct resource with zero loss of context. \nProject Manager | Dry Patrol of Central Ohio (Permanent Franchise Closure) | Aug 2018 – \nDec 2020 \n● Crisis Operations: Led time-critical logistics and resource allocation for multiple \nconcurrent property disaster restoration projects, ensuring strict adherence to safety \ntimelines and deployment efficiency. \n● Stakeholder Communication: Managed direct communications with stressed property \nowners and field teams during critical operational phases, resolving high-friction \nescalations with professionalism and clarity. \n● Resource Coordination: Balanced project scheduling, equipment tracking, and \nfranchise vendor timelines under intense pressure until operations successfully \nconcluded due to permanent business closure. \nEDUCATION & CERTIFICATIONS \n● Google Cybersecurity Professional Certificate | Coursera (Focus on Networks, OS, \nand Support) \n● CompTIA A+ | In Progress \n● High School Diploma | Newark High School",
      "tailoredResumeText": "# MICHAEL BURSON\nNew Concord, OH | 740.755.0345 | Mburson99@gmail.com\nLinkedIn: https://www.linkedin.com/in/mjburson | Portfolio: https://github.com/mburson99-arch/AD-splunk-lab\n\n## PROFESSIONAL SUMMARY\nDedicated and adaptable professional with 5+ years of remote operational experience, now pivoting into IT Support. Leveraging a robust foundation in customer service, strict SLA management, and high-stakes incident resolution to deliver prompt and effective technical assistance. Proven hands-on IT infrastructure experience in Windows Server, Active Directory, GPO management, TCP/IP fundamentals, and VPN troubleshooting, developed through a self-hosted enterprise lab environment. Eager to contribute problem-solving skills and an energetic approach to ensure seamless technology operations and exceptional user support in a remote capacity.\n\n## TECHNICAL SKILLS\n*   **Operating Systems & Server Environments:** Windows Server/Client OS, Active Directory (ADUC), Group Policy Objects (GPOs), RBAC (Role-Based Access Control), Windows Server Administration\n*   **Network & Connectivity Support:** VPN Configuration & Troubleshooting, DNS/DHCP Configuration, Remote Desktop Protocol (RDP), Multi-VM Architecture, TCP/IP Protocol Fundamentals, LAN/WAN Concepts (Virtualized), Basic Network Diagnostics (ping, tracert), Firewall Principles (e.g., Meraki familiarity)\n*   **Help Desk & Service Management Concepts:** Enterprise Incident Simulation, SLA Management, Remote Software Deployment, Root-Cause Documentation, High-Pressure Communication, Incident Resolution, Incident Tracking & Resolution Documentation (e.g., ServiceNow, Jira principles), SCCM/GPO for Patch Management\n*   **Hardware & Peripherals:** Mobile Device Troubleshooting, Remote Hardware Diagnostics & Support Principles (Desktops, Laptops, Mobile Devices, Printers, Peripherals)\n\n## FEATURED TECHNICAL PROJECT\n### Enterprise Service Desk & Identity Management Lab | Self-Hosted | Dec 2024 – Present\nEngineered a virtualized sandbox environment to master Level 1 Helpdesk operations, Windows systems administration, and live infrastructure troubleshooting, directly simulating enterprise support scenarios.\n*   **Multi-Platform Infrastructure:** Successfully built and networked a 4-Virtual Machine topology (including Windows Server) to simulate an enterprise Windows server-client environment, establishing foundational LAN/WAN concepts and TCP/IP connectivity.\n*   **Access Control & Security:** Implemented Active Directory and Role-Based Access Controls to enforce the principle of least privilege, configuring distinct administrative tiers and user permissions across the network.\n*   **Policy Management & Troubleshooting:** Deliberately introduced Active Directory policy failures and forced update disruptions to replicate real-world service incidents, successfully diagnosing and resolving registry/policy blocks.\n*   **Remote Deployment & Updates:** Utilized Group Policy Objects (GPOs) for simultaneous remote software deployment, updates, and configuration across all connected client endpoints, mimicking enterprise patch management and deployment strategies (similar to SCCM functions).\n*   **Incident Documentation:** Logged simulated incidents within a local tracking system, detailing root causes and step-by-step resolution paths, directly mirroring help desk ticketing system practices and preparing for platforms like ServiceNow or Jira.\n*   **Network Component Configuration:** Configured and troubleshot DNS, DHCP, and VPN within the virtualized network, ensuring robust connectivity and resource access.\n*   **Network Diagnostics:** Conducted basic network diagnostics within the virtual environment, verifying DNS configurations and troubleshooting connectivity issues between VMs using fundamental TCP/IP commands (e.g., ping, tracert).\n\n## PROFESSIONAL EXPERIENCE\n### Operations & Logistics Coordinator (Roadie & Spark) | Hotshot Hauling | Jan 2022 – Present\n*   **Remote Service Level Adherence:** Independently managed high-volume, time-sensitive remote delivery operations, consistently meeting strict Service Level Agreements (SLAs) for arrival and completion under zero direct supervision.\n*   **Field Hardware & Connectivity Troubleshooting:** Independently diagnosed and resolved mobile device application and connectivity issues in the field, troubleshooting device sync errors and authentication drops to ensure uninterrupted operations, demonstrating practical hardware and software problem-solving.\n*   **Remote Incident Resolution:** Communicated effectively with support dispatch and stakeholders via chat, email, and phone to resolve real-time routing anomalies and platform delivery issues, demonstrating strong remote problem-solving and communication.\n*   **Technical Upskilling:** Balanced ongoing logistics operations as a part-time role while dedicating 20+ hours weekly to independent technology certifications, virtualization projects, and system administration training.\n\n### Claims Specialist & Investigator | Allstate | May 2121 – Dec 2021\n*   **Comprehensive Incident Documentation:** Meticulously documented high volumes of user interactions and case evidence within internal enterprise systems, maintaining a comprehensive, audit-ready data trail for every file, akin to help desk incident logging.\n*   **Technical Information Translation:** Diagnosed complex, high-stakes inquiries to determine policy resolutions, successfully translating intricate technical guidelines into plain, professional language for non-technical clients.\n*   **Systematic Escalation Pathing:** Analyzed edge-case disputes and systematically routed complex, multi-tiered issues to specialized senior teams, ensuring files reached the correct resource with zero loss of context and efficient resolution.\n\n### Project Manager | Dry Patrol of Central Ohio (Permanent Franchise Closure) | Aug 2018 – Dec 2020\n*   **Crisis Operations Management:** Led time-critical logistics and resource allocation for multiple concurrent property disaster restoration projects, ensuring strict adherence to safety timelines and deployment efficiency under pressure.\n*   **Stakeholder Communication:** Managed direct communications with stressed property owners and field teams during critical operational phases, resolving high-friction escalations with professionalism and clarity.\n*   **Resource Coordination:** Balanced project scheduling, equipment tracking, and franchise vendor timelines under intense pressure until operations successfully concluded.\n\n## EDUCATION & CERTIFICATIONS\n*   Google Cybersecurity Professional Certificate | Coursera (Focus on Networks, OS, and Support)\n*   CompTIA A+ | In Progress\n*   High School Diploma | Newark High School",
      "critiqueMarkdown": "Resume matches.",
      "hasUnreadEmailUpdate": false,
      "emailUpdateCount": 0
    },
    {
      "id": "job-r6lswmn",
      "title": "Technical Product Support Specialist II - job post",
      "company": "Zoll Medical Corporation",
      "url": "https://www.indeed.com/jobs?q=Help+Desk+Technician&l=remote&from=searchOnDesktopSerp&vjk=f7588def10452287",
      "description": "Acute Care Technology\n\nWhy Join ZOLL?\n\nAt ZOLL Data Systems, we’re on a mission to save lives and improve clinical outcomes through advanced Enterprise and SaaS technology for EMS, hospital, and billing organizations. As a Technical Product Support Specialist II, you will handle more complex technical customer inquiries and provide advanced support for specific ZOLL enterprise products. You will manage issues with greater independence, using advanced troubleshooting skills and collaborating across teams or other departments when resolving multi-product or system-specific issues (e.g., DB, OS, Networking). This role includes contributing to the knowledge base and proactively analyzing technical trends to drive improvements in customer satisfaction\n\nWhat You'll Do\n\nManage advanced troubleshooting for assigned ZOLL enterprise products, using analytical skills to identify root causes of technical issues (e.g., DB, OS, Networking), adhering to ZDM for complete documentation in Salesforce.\n\nHandle complex technical issues independently, escalating only critical or unresolved problems to senior team members or CSO teams (e.g., Software Support, Implementation) or other departments (e.g., Product/R&D, SRE, IT App Hosting, Sales) as necessary, using Atlassian Jira Service Desk for handoffs.\n\nCollaborate with other CSO teams or departments to address technical issues thatspan across multiple products or systems, ensuring seamless cross-product support, using Microsoft Teams or Slack for resource navigation.\n\nContribute to the knowledge base, creating and updating articles with solutions to complex technical problems (KB Create) and sharing insights with the team, linking relevant KB articles (KM Linking %) in Salesforce and Atlassian Confluence.\n\nIdentify technical trends through customer case analysis, proposing preventative support initiatives to reduce recurring issues, swarming in collaboration channels to enhance reputation as a technical expert.\n\nTake a proactive approach by recognizing potential technical challenges and addressing them before they escalate, ensuring compliance with initial response and ANRD.\n\nCross-train on additional technical components within the suite (e.g., SQL Server, VMware), gaining a broader understanding of the ZOLL product ecosystem, using tools like Salesforce and Microsoft Teams.\n\nFacilitate incident management processes, coordinating team responses to ensure timely resolution of high-priority technical cases or outages and adherence to SLAs, using Atlassian Jira Service Desk and Microsoft Teams.\n\nOptimize hybrid meeting structures and remote team productivity guidelines, using virtual collaboration tools like Microsoft Teams, Slack, and LogMeIn Rescue to maintain technical service excellence.\n\nAdhere to customers’ preferred contact methods (e.g., Five9, email, LogMeIn Rescue) and monitor technical bugged cases in Pending Internal Status on a regular cadence, ensuring compliance with ANRD and resource engagement",
      "dateCaptured": "2026-05-26T13:18:24.735Z",
      "status": "captured",
      "hasUnreadEmailUpdate": false,
      "emailUpdateCount": 0
    }
  ];

  writeJSONFile(JOBS_FILE, defaultJobs);

  if (fs.existsSync(DELETED_JOBS_FILE)) {
    try {
      fs.unlinkSync(DELETED_JOBS_FILE);
    } catch (e) {}
  }

  writeJSONFile(EMAILS_FILE, [
    {
      id: "email-1",
      jobId: "job-r6lswmn",
      jobTitle: "Technical Product Support Specialist II - job post",
      company: "Zoll Medical Corporation",
      senderName: "Zoll Data Systems HR team",
      timestamp: new Date().toISOString(),
      subject: "Candidacy Update: Technical Support Specialist II",
      body: "Hi Michael,\n\nThank you for submitting your tailored resume for the Technical Product Support Specialist II opening. We noticed your robust hands-on virtualized enterprise lab project and found your remote SLA and customer handling skills highly applicable to this position.\n\nCould you please let us know your availability for a brief 15-minute phone screening with our support team lead this coming Thursday or Friday?\n\nBest regards,\nEleanor Vance\nCSO Talent Acquisition Team\nZoll Medical Corporation",
      type: "interview",
      isRead: true
    },
    {
      id: "email-2",
      jobId: "job-9xfrz5y",
      jobTitle: "IT Support Specialist - job post",
      company: "Mercer Bucks Technology",
      senderName: "Mercer Bucks Careers",
      timestamp: new Date().toISOString(),
      subject: "Application Confirmed: IT Support Specialist (Remote)",
      body: "Hi Michael Burson,\n\nThis automatic notification is to confirm that we have successfully received your tailored application for the IT Support Specialist role.\n\nOur service division is currently routing applications for manual review. We will contact you directly if there is alignment with our Meraki networking and SCCM operational workflows.\n\nKind regards,\nRecruitment Desk\nMercer Bucks Technology",
      type: "received",
      isRead: true
    }
  ]);

  res.json({ success: true, message: "Database reset to initial demo state." });
});

// Mark email as read

// 6. Logs API
app.get("/api/logs", (req, res) => {
  const logs = readJSONFile<any[]>(LOGS_FILE, []);
  res.json(logs);
});

app.post("/api/logs/clear", (req, res) => {
  writeJSONFile(LOGS_FILE, []);
  res.json({ success: true });
});

// Vite Middleware for assets / index serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            "**/*_db.json",
            "**/*_db.json.tmp",
            "**/.backups/**",
            "**/agents/**",
          ],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting robustly on http://0.0.0.0:${PORT}`);
    if (googleClientId) {
      console.log("Google OAuth: GOOGLE_CLIENT_ID loaded.");
    } else {
      console.warn("Google OAuth: GOOGLE_CLIENT_ID missing in .env — Gmail sign-in disabled.");
    }
  });
}

startServer();
