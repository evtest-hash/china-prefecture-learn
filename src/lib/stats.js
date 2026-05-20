export function computeStats(divisions, learnedSet) {
  const total = divisions.length;
  const learned = divisions.filter((d) => learnedSet.has(d.adcode)).length;
  const percentage = total > 0 ? Math.round((learned / total) * 100) : 0;

  const provinceMap = new Map();
  for (const d of divisions) {
    if (!provinceMap.has(d.provinceAdcode)) {
      provinceMap.set(d.provinceAdcode, { name: d.province, total: 0, learned: 0 });
    }
    const prov = provinceMap.get(d.provinceAdcode);
    prov.total += 1;
    if (learnedSet.has(d.adcode)) prov.learned += 1;
  }

  const provincesCovered = [...provinceMap.values()].filter((p) => p.learned > 0).length;

  return {
    total,
    learned,
    remaining: total - learned,
    percentage,
    provincesCovered,
    totalProvinces: provinceMap.size,
    provinceStats: [...provinceMap.values()],
  };
}

export function renderStats(stats) {
  return [
    { label: "已学习", value: `${stats.learned} / ${stats.total}` },
    { label: "完成进度", value: `${stats.percentage}%` },
    { label: "覆盖省份", value: `${stats.provincesCovered} / ${stats.totalProvinces}` },
    { label: "剩余", value: `${stats.remaining} 个` },
  ];
}
