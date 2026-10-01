// Seed fixture: people have emails/roles; projects have ids and customers.
const people = [
  { id: "u1", name: "Maya Chen", email: "maya@harborly.demo", role: "Head of Product" },
  { id: "u2", name: "Leo Park", email: "leo@harborly.demo", role: "Engineering Lead" },
];

const projects = [{ id: "prj_launch", name: "Q3 Launch", status: "in-progress", customer: "Acme Rockets" }];

const workspace = { company: "Northwind", plan: "Team" };

console.log(JSON.stringify({ people, projects, workspace }));
