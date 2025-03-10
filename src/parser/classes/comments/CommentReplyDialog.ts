import Parser from '../../index';
import Thumbnail from '../misc/Thumbnail';
import Text from '../misc/Text';
import type Button from '../Button';
import { YTNode } from '../../helpers';

class CommentReplyDialog extends YTNode {
  static type = 'CommentReplyDialog';

  reply_button: Button | null;
  cancel_button: Button | null;
  author_thumbnail: Thumbnail[];
  placeholder: Text;
  error_message: Text;

  constructor(data: any) {
    super();
    this.reply_button = Parser.parseItem<Button>(data.replyButton);
    this.cancel_button = Parser.parseItem<Button>(data.cancelButton);
    this.author_thumbnail = Thumbnail.fromResponse(data.authorThumbnail);
    this.placeholder = new Text(data.placeholderText);
    this.error_message = new Text(data.errorMessage);
  }
}

export default CommentReplyDialog;