export type SkillsTaxonomy = {
  synonyms: Record<string, string[]>;
  parents: Record<string, string[]>; // child -> parent categories/skills
};

export const SKILLS_TAXONOMY: SkillsTaxonomy = {
  synonyms: {
    'c#': ['c sharp', 'c-sharp'],
    'node.js': ['node', 'nodejs'],
    'postgresql': ['postgres', 'psql'],
    'sql server': ['mssql'],
    'google cloud': ['gcp', 'google cloud platform'],
    'aws': ['amazon web services'],
    'ci/cd': ['cicd', 'ci cd', 'continuous integration', 'continuous delivery'],
    'ux': ['user experience'],
    'ui': ['user interface'],
    'html': ['html5'],
    'css': ['css3'],
    'adobe photoshop': ['photoshop'],
    'adobe illustrator': ['illustrator'],
    'bbbee': ['bee', 'b-bbee', 'b-bbee compliance']
  },
  parents: {
    'typescript': ['javascript'],
    'next.js': ['react'],
    'nuxt.js': ['vue'],
    'sequelize': ['orm', 'sql'],
    'prisma': ['orm', 'sql'],
    'terraform': ['devops', 'infrastructure as code'],
    'ansible': ['devops', 'configuration management'],
    'docker': ['devops', 'containers'],
    'kubernetes': ['devops', 'containers'],
    'gcp': ['cloud'],
    'aws': ['cloud'],
    'azure': ['cloud']
  }
};

/** Normalize a single skill string using synonyms table */
export function normalizeSkill(skill: string): string {
  const s = skill.trim().toLowerCase();
  // Direct canonical names
  for (const [canonical, syns] of Object.entries(SKILLS_TAXONOMY.synonyms)) {
    if (s === canonical) return canonical;
    if (syns.includes(s)) return canonical;
  }
  // Minor trims: remove dots and extra spaces variants often seen
  const cleaned = s.replace(/\./g, '').replace(/\s+/g, ' ').trim();
  for (const [canonical, syns] of Object.entries(SKILLS_TAXONOMY.synonyms)) {
    if (cleaned === canonical.replace(/\./g, '')) return canonical;
    if (syns.some(v => v.replace(/\./g, '') === cleaned)) return canonical;
  }
  return s;
}

/** Expand skills with synonyms and parent mappings, return a normalized set */
export function expandSkills(skills: string[]): Set<string> {
  const out = new Set<string>();
  for (const sk of skills) {
    const norm = normalizeSkill(sk);
    out.add(norm);
    // Include synonyms (bidirectional)
    for (const [canonical, syns] of Object.entries(SKILLS_TAXONOMY.synonyms)) {
      if (canonical === norm || syns.includes(norm)) {
        out.add(canonical);
        syns.forEach(s => out.add(s));
      }
    }
    // Include parents
    const parents = SKILLS_TAXONOMY.parents[norm];
    if (parents) parents.forEach(p => out.add(p));
  }
  return out;
}

