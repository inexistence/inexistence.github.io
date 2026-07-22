import { Collapse } from 'animal-island-ui/es/components/Collapse/Collapse.js';
import { Tag } from 'animal-island-ui/es/components/Tag/Tag.js';
import { categoryColor } from '../lib/category';

interface ArchiveItem {
  title: string;
  href: string;
  date: string;
  publishDate: string;
  category: string;
}

interface YearGroup {
  year: string;
  posts: ArchiveItem[];
}

export default function ArchiveCollapse({ groups }: { groups: YearGroup[] }) {
  return (
    <div className="archive-collapses">
      {groups.map((group, index) => (
        <Collapse
          key={group.year}
          question={`${group.year} · ${group.posts.length} 篇`}
          defaultExpanded={index === 0}
          answer={
            <ul className="archive-collapse-list">
              {group.posts.map((post) => (
                <li key={post.href}>
                  <a href={post.href}>
                    <span>{post.title}</span>
                    <time dateTime={post.publishDate}>{post.date}</time>
                    <Tag
                      className="archive-collapse-list__tag"
                      size="small"
                      variant="soft"
                      color={categoryColor(post.category)}
                    >
                      {post.category}
                    </Tag>
                  </a>
                </li>
              ))}
            </ul>
          }
        />
      ))}
    </div>
  );
}
