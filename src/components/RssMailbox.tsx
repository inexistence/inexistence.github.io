import { Tooltip } from 'animal-island-ui';
import mailboxIcon from 'animal-island-ui/items/item-475.png';

export default function RssMailbox() {
  return (
    <Tooltip
      className="rss-mailbox-tooltip"
      title="订阅岛屿广播"
      placement="bottom-end"
      trigger="hover"
      variant="island"
      bordered={false}
    >
      <a className="rss-mailbox" href="/rss.xml" aria-label="订阅岛屿广播（RSS）">
        <img src={mailboxIcon.src} alt="" width="42" height="42" />
      </a>
    </Tooltip>
  );
}
