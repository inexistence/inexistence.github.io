export function categoryColor(category: string) {
  const colors = {
    技术: 'app-teal',
    日志: 'app-yellow',
    小说: 'purple',
    其他: 'app-orange',
    二次元: 'warm-peach-pink',
    测试: 'app-blue',
  } as const;

  return colors[category as keyof typeof colors] ?? 'app-green';
}
