import Parser from '../../index';
import { YTNode } from '../../helpers';

class ShowLiveChatTooltipCommand extends YTNode {
  static type = 'ShowLiveChatTooltipCommand';

  tooltip;

  constructor(data: any) {
    super();
    this.tooltip = Parser.parseItem(data.tooltip);
  }
}

export default ShowLiveChatTooltipCommand;