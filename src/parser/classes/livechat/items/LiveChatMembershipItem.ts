import { observe, ObservedArray, YTNode } from '../../../helpers';
import Parser from '../../../index';
import LiveChatAuthorBadge from '../../LiveChatAuthorBadge';
import MetadataBadge from '../../MetadataBadge';
import Text from '../../misc/Text';
import Thumbnail from '../../misc/Thumbnail';
import NavigationEndpoint from '../../NavigationEndpoint';

class LiveChatMembershipItem extends YTNode {
  static type = 'LiveChatMembershipItem';

  id: string;
  timestamp: number;
  header_subtext: Text;

  author: {
    id: string;
    name: Text;
    thumbnails: Thumbnail[];
    badges: ObservedArray<LiveChatAuthorBadge | MetadataBadge>;
    is_moderator: boolean | null;
    is_verified: boolean | null;
    is_verified_artist: boolean | null;
  };

  menu_endpoint: NavigationEndpoint;

  constructor(data: any) {
    super();
    this.id = data.id;
    this.timestamp = Math.floor(parseInt(data.timestampUsec) / 1000);
    this.header_subtext = new Text(data.headerSubtext);

    this.author = {
      id: data.authorExternalChannelId,
      name: new Text(data?.authorName),
      thumbnails: Thumbnail.fromResponse(data.authorPhoto),
      badges: observe([]).as(LiveChatAuthorBadge, MetadataBadge),
      is_moderator: null,
      is_verified: null,
      is_verified_artist: null
    };

    const badges = Parser.parseArray<LiveChatAuthorBadge | MetadataBadge>(data.authorBadges);

    this.author.badges = badges;
    this.author.is_moderator = badges ? badges.some((badge) => badge.icon_type == 'MODERATOR') : null;
    this.author.is_verified = badges ? badges.some((badge) => badge.style == 'BADGE_STYLE_TYPE_VERIFIED') : null;
    this.author.is_verified_artist = badges ? badges.some((badge) => badge.style == 'BADGE_STYLE_TYPE_VERIFIED_ARTIST') : null;

    this.menu_endpoint = new NavigationEndpoint(data.contextMenuEndpoint);
  }
}

export default LiveChatMembershipItem;