import Parser from '../index';
import type Menu from './menus/Menu';
import type Button from './Button';
import type SortFilterSubMenu from './SortFilterSubMenu';
import { YTNode } from '../helpers';

class LiveChatHeader extends YTNode {
  static type = 'LiveChatHeader';

  overflow_menu: Menu | null;
  collapse_button: Button | null;
  view_selector: SortFilterSubMenu | null;

  constructor(data: any) {
    super();
    this.overflow_menu = Parser.parseItem<Menu>(data.overflowMenu);
    this.collapse_button = Parser.parseItem<Button>(data.collapseButton);
    this.view_selector = Parser.parseItem<SortFilterSubMenu>(data.viewSelector);
  }
}

export default LiveChatHeader;