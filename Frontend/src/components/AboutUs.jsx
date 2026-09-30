const teamMembers = [
  { name: "Kundhan Akkenapally", role: "Team Leader & AI and ML Developer", email: "kundhanakkenapally@gmail.com", phone: "+91 6300086052", github: "https://github.com/replace-with-kundhan-username" },
  { name: "Hari Chandana Siva Durga Gedela", role: "Team Manager & AI/ML Developer", email: "gedelaharichandana39@gmail.com", phone: "+91 9505286764", github: "https://github.com/replace-with-hari-chandana-username" },
  { name: "Poojitha Nagothi", role: "Backend Developer", email: "poojithanagothi@gmail.com", phone: "+91 8309873732", github: "https://github.com/replace-with-poojitha-username" },
  { name: "Amith Reddy Yanala", role: "Presentation and Documentation", email: "amithreddyyanala2006@gmail.com", phone: "+91 9515424862", github: "https://github.com/replace-with-amith-username" },
  { name: "Prem Macharla", role: "Research and Analysis", email: "premmacharla2007@gmail.com", phone: "+91 8247699591", github: "https://github.com/replace-with-prem-username" },
  { name: "Nammi Sethu Sampath", role: "Frontend Developer", email: "Sethusampath.01112006@gmail.com", phone: "+91 9392759523", github: "https://github.com/Sethu-Sampath" },
];

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.06c-3.1.67-3.75-1.31-3.75-1.31-.5-1.29-1.23-1.63-1.23-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15.99 1.7 2.59 1.21 3.22.93.1-.72.39-1.21.7-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.21 1.15-2.99-.12-.28-.5-1.42.11-2.95 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.11-1.44 3.04-1.14 3.04-1.14.61 1.53.23 2.67.12 2.95.71.78 1.14 1.77 1.14 2.99 0 4.29-2.61 5.23-5.1 5.51.4.35.75 1.03.75 2.08V22c0 .29.2.63.76.52A11.1 11.1 0 0 0 12 .9Z" />
    </svg>
  );
}

export default function AboutUs() {
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ABOUT POLAROPS</span>
          <h1>About Our Team</h1>
          <p>Meet the people behind PolarOps.</p>
        </div>
      </div>
      <div className="about-team-grid">
        {teamMembers.map((member) => (
          <article className="about-team-card" key={member.name}>
            <div className="about-team-card-heading">
              <div>
                <h2>{member.name}</h2>
                <p>{member.role}</p>
              </div>
              <a
                className="about-github-link"
                href={member.github}
                target="_blank"
                rel="noreferrer"
                aria-label={"Visit GitHub for " + member.name}
              >
                <GitHubIcon />
              </a>
            </div>
            <div className="about-team-contact">
              <a href={"mailto:" + member.email}>{member.email}</a>
              <a href={"tel:" + member.phone.replaceAll(" ", "")}>{member.phone}</a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}