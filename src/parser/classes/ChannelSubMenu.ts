import Parser from '..';
import NavigationEndpoint from './NavigationEndpoint';
import { YTNode } from '../helpers';

class ChannelSubMenu extends YTNode {
  static type = 'ChannelSubMenu';

  content_type_sub_menu_items: {
    endpoint: NavigationEndpoint;
    selected: boolean;
    title: string;
  }[];

  sort_setting;

  constructor(data: any) {
    super();
    this.content_type_sub_menu_items = data.contentTypeSubMenuItems.map((item: any) => ({
      endpoint: new NavigationEndpoint(item.navigationEndpoint || item.endpoint),
      selected: item.selected,
      title: item.title
    }));
    this.sort_setting = Parser.parseItem(data.sortSetting);
  }
}

export default ChannelSubMenu;