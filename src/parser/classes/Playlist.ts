import Text from './misc/Text';
import Parser from '../index';
import Thumbnail from './misc/Thumbnail';
import NavigationEndpoint from './NavigationEndpoint';
import PlaylistAuthor from './misc/PlaylistAuthor';
import { YTNode } from '../helpers';

class Playlist extends YTNode {
  static type = 'Playlist';

  id: string;
  title: Text;
  author: Text | PlaylistAuthor;
  thumbnails: Thumbnail[];
  video_count: Text;
  video_count_short: Text;
  first_videos;
  share_url: string | null;
  menu;
  badges;
  endpoint: NavigationEndpoint;
  thumbnail_overlays;

  constructor(data: any) {
    super();
    this.id = data.playlistId;
    this.title = new Text(data.title);

    this.author = data.shortBylineText?.simpleText ?
      new Text(data.shortBylineText) :
      new PlaylistAuthor(data.longBylineText, data.ownerBadges, null);

    this.thumbnails = Thumbnail.fromResponse(data.thumbnail || { thumbnails: data.thumbnails.map((th: any) => th.thumbnails).flat(1) });
    this.video_count = new Text(data.thumbnailText);
    this.video_count_short = new Text(data.videoCountShortText);
    this.first_videos = Parser.parseArray(data.videos);
    this.share_url = data.shareUrl || null;
    this.menu = Parser.parseItem(data.menu);
    this.badges = Parser.parseArray(data.ownerBadges);
    this.endpoint = new NavigationEndpoint(data.navigationEndpoint);
    this.thumbnail_overlays = Parser.parseArray(data.thumbnailOverlays);
  }
}

export default Playlist;