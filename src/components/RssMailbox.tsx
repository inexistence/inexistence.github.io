import mailboxIcon from 'animal-island-ui/items/item-475.png';

export default function RssMailbox() {
  return (
    <a className="rss-mailbox" href="/rss.xml" aria-label="订阅岛屿广播（RSS）">
      <img src={mailboxIcon.src} alt="" width="42" height="42" />
    </a>
  );
}
