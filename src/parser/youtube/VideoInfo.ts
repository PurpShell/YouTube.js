import Constants from '../../utils/Constants';
import Parser, { ParsedResponse } from '../index';

import TwoColumnWatchNextResults from '../classes/TwoColumnWatchNextResults';
import VideoPrimaryInfo from '../classes/VideoPrimaryInfo';
import VideoSecondaryInfo from '../classes/VideoSecondaryInfo';

import MerchandiseShelf from '../classes/MerchandiseShelf';
import RelatedChipCloud from '../classes/RelatedChipCloud';

import ChipCloud from '../classes/ChipCloud';
import ChipCloudChip from '../classes/ChipCloudChip';
import CommentsEntryPointHeader from '../classes/comments/CommentsEntryPointHeader';
import ContinuationItem from '../classes/ContinuationItem';
import ItemSection from '../classes/ItemSection';
import LiveChat from '../classes/LiveChat';
import MicroformatData from '../classes/MicroformatData';
import PlayerMicroformat from '../classes/PlayerMicroformat';
import PlayerOverlay from '../classes/PlayerOverlay';
import SegmentedLikeDislikeButton from '../classes/SegmentedLikeDislikeButton';
import ToggleButton from '../classes/ToggleButton';
import LiveChatWrap from './LiveChat';

import type CardCollection from '../classes/CardCollection';
import type Endscreen from '../classes/Endscreen';
import type Format from '../classes/misc/Format';
import type PlayerAnnotationsExpanded from '../classes/PlayerAnnotationsExpanded';
import type PlayerCaptionsTracklist from '../classes/PlayerCaptionsTracklist';
import type PlayerLiveStoryboardSpec from '../classes/PlayerLiveStoryboardSpec';
import type PlayerStoryboardSpec from '../classes/PlayerStoryboardSpec';

import type Player from '../../core/Player';
import type Actions from '../../core/Actions';
import type { ApiResponse } from '../../core/Actions';
import type { ObservedArray, YTNode } from '../helpers';

import FormatUtils, { FormatOptions, DownloadOptions, URLTransformer, FormatFilter } from '../../utils/FormatUtils';

import { InnertubeError } from '../../utils/Utils';

class VideoInfo {
  #page: [ParsedResponse, ParsedResponse?];

  #actions: Actions;
  #player?: Player;
  #cpn?: string;
  #watch_next_continuation?: ContinuationItem;

  basic_info;
  streaming_data;
  playability_status;
  annotations: ObservedArray<PlayerAnnotationsExpanded>;
  storyboards: PlayerStoryboardSpec | PlayerLiveStoryboardSpec | null;
  endscreen: Endscreen | null;
  captions: PlayerCaptionsTracklist | null;
  cards: CardCollection | null;

  #playback_tracking;

  primary_info?: VideoPrimaryInfo | null;
  secondary_info?: VideoSecondaryInfo | null;
  merchandise?: MerchandiseShelf | null;
  related_chip_cloud?: ChipCloud | null;
  watch_next_feed?: ObservedArray<YTNode> | null;
  player_overlays?: PlayerOverlay | null;
  comments_entry_point_header?: CommentsEntryPointHeader | null;
  livechat?: LiveChat | null;

  /**
   * @param data - API response.
   * @param actions - Actions instance.
   * @param player - Player instance.
   * @param cpn - Client Playback Nonce.
   */
  constructor(data: [ApiResponse, ApiResponse?], actions: Actions, player?: Player, cpn?: string) {
    this.#actions = actions;
    this.#player = player;
    this.#cpn = cpn;

    const info = Parser.parseResponse(data[0].data);
    const next = data?.[1]?.data ? Parser.parseResponse(data[1].data) : undefined;

    this.#page = [ info, next ];

    if (info.playability_status?.status === 'ERROR')
      throw new InnertubeError('This video is unavailable', info.playability_status);

    if (info.microformat && !info.microformat?.is(PlayerMicroformat, MicroformatData))
      throw new InnertubeError('Invalid microformat', info.microformat);

    this.basic_info = { // This type is inferred so no need for an explicit type
      ...info.video_details,
      /**
       * Microformat is a bit redundant, so only
       * a few things there are interesting to us.
       */
      ...{
        embed: info.microformat?.is(PlayerMicroformat) ? info.microformat?.embed : null,
        channel: info.microformat?.is(PlayerMicroformat) ? info.microformat?.channel : null,
        is_unlisted: info.microformat?.is_unlisted,
        is_family_safe: info.microformat?.is_family_safe,
        has_ypc_metadata: info.microformat?.is(PlayerMicroformat) ? info.microformat?.has_ypc_metadata : null,
        start_timestamp: info.microformat?.is(PlayerMicroformat) ? info.microformat.start_timestamp : null
      },
      like_count: undefined as number | undefined,
      is_liked: undefined as boolean | undefined,
      is_disliked: undefined as boolean | undefined
    };

    this.streaming_data = info.streaming_data;
    this.playability_status = info.playability_status;
    this.annotations = info.annotations;
    this.storyboards = info.storyboards;
    this.endscreen = info.endscreen;
    this.captions = info.captions;
    this.cards = info.cards;

    this.#playback_tracking = info.playback_tracking;

    const two_col = next?.contents.item().as(TwoColumnWatchNextResults);

    const results = two_col?.results;
    const secondary_results = two_col?.secondary_results;

    if (results && secondary_results) {
      this.primary_info = results.firstOfType(VideoPrimaryInfo);
      this.secondary_info = results.firstOfType(VideoSecondaryInfo);
      this.merchandise = results.firstOfType(MerchandiseShelf);
      this.related_chip_cloud = secondary_results.firstOfType(RelatedChipCloud)?.content.item().as(ChipCloud);

      this.watch_next_feed = secondary_results.firstOfType(ItemSection)?.contents || secondary_results;

      if (this.watch_next_feed && Array.isArray(this.watch_next_feed) && this.watch_next_feed.at(-1)?.is(ContinuationItem))
        this.#watch_next_continuation = this.watch_next_feed.pop()?.as(ContinuationItem);

      this.player_overlays = next?.player_overlays.item().as(PlayerOverlay);

      const segmented_like_dislike_button = this.primary_info?.menu?.top_level_buttons.firstOfType(SegmentedLikeDislikeButton);

      this.basic_info.like_count = segmented_like_dislike_button?.like_button?.as(ToggleButton)?.like_count;
      this.basic_info.is_liked = segmented_like_dislike_button?.like_button?.as(ToggleButton)?.is_toggled;
      this.basic_info.is_disliked = segmented_like_dislike_button?.dislike_button?.as(ToggleButton)?.is_toggled;

      const comments_entry_point = results.get({ target_id: 'comments-entry-point' })?.as(ItemSection);

      this.comments_entry_point_header = comments_entry_point?.contents?.firstOfType(CommentsEntryPointHeader);
      this.livechat = next?.contents_memo.getType(LiveChat).first();
    }
  }

  /**
   * Applies given filter to the watch next feed. Use {@link filters} to get available filters.
   * @param target_filter - Filter to apply.
   */
  async selectFilter(target_filter: string | ChipCloudChip | undefined): Promise<VideoInfo> {
    if (!this.related_chip_cloud)
      throw new InnertubeError('Chip cloud not found, cannot apply filter');

    let cloud_chip: ChipCloudChip;

    if (typeof target_filter === 'string') {
      const filter = this.related_chip_cloud?.chips?.get({ text: target_filter });

      if (!filter)
        throw new InnertubeError('Invalid filter', { available_filters: this.filters });

      cloud_chip = filter;
    } else if (target_filter?.is(ChipCloudChip)) {
      cloud_chip = target_filter;
    } else {
      throw new InnertubeError('Invalid cloud chip', target_filter);
    }

    if (cloud_chip.is_selected) return this;

    const response = await cloud_chip.endpoint?.call(this.#actions, { parse: true });
    const data = response?.on_response_received_endpoints?.get({ target_id: 'watch-next-feed' });

    this.watch_next_feed = data?.contents;

    return this;
  }

  /**
   * Adds video to the watch history.
   */
  async addToWatchHistory(): Promise<Response> {
    if (!this.#playback_tracking)
      throw new InnertubeError('Playback tracking not available');

    const url_params = {
      cpn: this.#cpn,
      fmt: 251,
      rtn: 0,
      rt: 0
    };

    const url = this.#playback_tracking.videostats_playback_url.replace('https://s.', 'https://www.');

    const response = await this.#actions.stats(url, {
      client_name: Constants.CLIENTS.WEB.NAME,
      client_version: Constants.CLIENTS.WEB.VERSION
    }, url_params);

    return response;
  }


  /**
   * Retrieves watch next feed continuation.
   */
  async getWatchNextContinuation(): Promise<VideoInfo> {
    if (!this.#watch_next_continuation)
      throw new InnertubeError('Watch next feed continuation not found');

    const response = await this.#watch_next_continuation?.endpoint.call(this.#actions, { parse: true });
    const data = response?.on_response_received_endpoints?.get({ type: 'appendContinuationItemsAction' });

    if (!data)
      throw new InnertubeError('AppendContinuationItemsAction not found');

    this.watch_next_feed = data?.contents;
    if (this.watch_next_feed?.at(-1)?.is(ContinuationItem)) {
      this.#watch_next_continuation = this.watch_next_feed.pop()?.as(ContinuationItem);
    } else {
      this.#watch_next_continuation = undefined;
    }

    return this;
  }

  /**
   * Likes the video.
   */
  async like(): Promise<ApiResponse> {
    const segmented_like_dislike_button = this.primary_info?.menu?.top_level_buttons.firstOfType(SegmentedLikeDislikeButton);
    const button = segmented_like_dislike_button?.like_button?.as(ToggleButton);

    if (!button)
      throw new InnertubeError('Like button not found', { video_id: this.basic_info.id });

    if (button.is_toggled)
      throw new InnertubeError('This video is already liked', { video_id: this.basic_info.id });

    const response = await button.endpoint.call(this.#actions);

    return response;
  }

  /**
   * Dislikes the video.
   */
  async dislike(): Promise<ApiResponse> {
    const segmented_like_dislike_button = this.primary_info?.menu?.top_level_buttons.firstOfType(SegmentedLikeDislikeButton);
    const button = segmented_like_dislike_button?.dislike_button?.as(ToggleButton);

    if (!button)
      throw new InnertubeError('Dislike button not found', { video_id: this.basic_info.id });

    if (button.is_toggled)
      throw new InnertubeError('This video is already disliked', { video_id: this.basic_info.id });

    const response = await button.endpoint.call(this.#actions);

    return response;
  }

  /**
   * Removes like/dislike.
   */
  async removeRating(): Promise<ApiResponse> {
    let button;

    const segmented_like_dislike_button = this.primary_info?.menu?.top_level_buttons.firstOfType(SegmentedLikeDislikeButton);
    const like_button = segmented_like_dislike_button?.like_button?.as(ToggleButton);
    const dislike_button = segmented_like_dislike_button?.dislike_button?.as(ToggleButton);

    if (like_button?.is_toggled) {
      button = like_button;
    } else if (dislike_button?.is_toggled) {
      button = dislike_button;
    }

    if (!button)
      throw new InnertubeError('This video is not liked/disliked', { video_id: this.basic_info.id });

    const response = await button.toggled_endpoint.call(this.#actions);

    return response;
  }

  /**
   * Retrieves Live Chat if available.
   */
  getLiveChat(): LiveChatWrap {
    if (!this.livechat)
      throw new InnertubeError('Live Chat is not available', { video_id: this.basic_info.id });
    return new LiveChatWrap(this);
  }

  /**
   * Selects the format that best matches the given options.
   * @param options - Options
   */
  chooseFormat(options: FormatOptions): Format {
    return FormatUtils.chooseFormat(options, this.streaming_data);
  }

  /**
   * Generates a DASH manifest from the streaming data.
   * @param url_transformer - Function to transform the URLs.
   * @param format_filter - Function to filter the formats.
   * @returns DASH manifest
   */
  toDash(url_transformer: URLTransformer = (url) => url, format_filter: FormatFilter): string {
    return FormatUtils.toDash(this.streaming_data, url_transformer, format_filter, this.#cpn, this.#player);
  }

  /**
   * Downloads the video.
   * @param options - Download options.
   */
  async download(options: DownloadOptions = {}): Promise<ReadableStream<Uint8Array>> {
    return FormatUtils.download(options, this.#actions, this.playability_status, this.streaming_data, this.#actions.session.player, this.cpn);
  }

  /**
   * Watch next feed filters.
   */
  get filters(): string[] {
    return this.related_chip_cloud?.chips?.map((chip) => chip.text?.toString()) || [];
  }

  /**
   * Actions instance.
   */
  get actions(): Actions {
    return this.#actions;
  }

  /**
   * Content Playback Nonce.
   */
  get cpn(): string | undefined {
    return this.#cpn;
  }

  /**
   * Checks if continuation is available for the watch next feed.
   */
  get wn_has_continuation(): boolean {
    return !!this.#watch_next_continuation;
  }

  /**
   * Get songs used in the video.
   */
  // TODO: this seems to be broken with the new UI, further investigation needed
  get music_tracks() {
    /*
        Const metadata = this.secondary_info?.metadata;
        if (!metadata)
            return [];
        const songs = [];
        let current_song: Record<string, Text[]> = {};
        let is_music_section = false;
        for (let i = 0; i < metadata.rows.length; i++) {
            const row = metadata.rows[i];
            if (row.is(MetadataRowHeader)) {
                if (row.content?.toString().toLowerCase().startsWith('music')) {
                    is_music_section = true;
                    i++; // Skip the learn more link
                }
                continue;
            }
            if (!is_music_section)
                continue;
            if (row.is(MetadataRow))
                current_song[row.title?.toString().toLowerCase().replace(/ /g, '_')] = row.contents;
            // TODO: this makes no sense, we continue above when
            if (row.has_divider_line) {
                songs.push(current_song);
                current_song = {};
            }

        }
        if (is_music_section)
            songs.push(current_song);
        return songs;
        */
    return [];
  }

  /**
   * Original parsed InnerTube response.
   */
  get page(): [ParsedResponse, ParsedResponse?] {
    return this.#page;
  }
}

export default VideoInfo;