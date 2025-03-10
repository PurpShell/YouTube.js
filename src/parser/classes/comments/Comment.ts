import Parser from '../../index';

import Text from '../misc/Text';
import Thumbnail from '../misc/Thumbnail';
import CommentReplyDialog from './CommentReplyDialog';
import AuthorCommentBadge from './AuthorCommentBadge';
import Author from '../misc/Author';

import type Menu from '../menus/Menu';
import type CommentActionButtons from './CommentActionButtons';
import type SponsorCommentBadge from './SponsorCommentBadge';
import type PdgCommentChip from './PdgCommentChip';
import type { ApiResponse } from '../../../core/Actions';
import type Actions from '../../../core/Actions';

import Proto from '../../../proto/index';
import { InnertubeError } from '../../../utils/Utils';
import { YTNode, SuperParsedResult } from '../../helpers';

class Comment extends YTNode {
  static type = 'Comment';

  #actions?: Actions;

  content: Text;
  published: Text;
  author_is_channel_owner: boolean;
  current_user_reply_thumbnail: Thumbnail[];
  sponsor_comment_badge: SponsorCommentBadge | null;
  paid_comment_chip: PdgCommentChip | null;
  author_badge: AuthorCommentBadge | null;
  author: Author;
  action_menu: Menu | null;
  action_buttons: CommentActionButtons | null;
  comment_id: string;
  vote_status: string;

  vote_count: string;

  reply_count: number;
  is_liked: boolean;
  is_disliked: boolean;
  is_hearted: boolean;
  is_pinned: boolean;
  is_member: boolean;

  constructor(data: any) {
    super();
    this.content = new Text(data.contentText);
    this.published = new Text(data.publishedTimeText);
    this.author_is_channel_owner = data.authorIsChannelOwner;
    this.current_user_reply_thumbnail = Thumbnail.fromResponse(data.currentUserReplyThumbnail);
    this.sponsor_comment_badge = Parser.parseItem<SponsorCommentBadge>(data.sponsorCommentBadge);
    this.paid_comment_chip = Parser.parseItem<PdgCommentChip>(data.paidCommentChipRenderer);
    this.author_badge = Parser.parseItem<AuthorCommentBadge>(data.authorCommentBadge, AuthorCommentBadge);

    this.author = new Author({
      ...data.authorText,
      navigationEndpoint: data.authorEndpoint
    }, this.author_badge ? [ {
      metadataBadgeRenderer: this.author_badge?.orig_badge
    } ] : null, data.authorThumbnail);

    this.action_menu = Parser.parseItem<Menu>(data.actionMenu);
    this.action_buttons = Parser.parseItem<CommentActionButtons>(data.actionButtons);
    this.comment_id = data.commentId;
    this.vote_status = data.voteStatus;

    this.vote_count = data.voteCount ? new Text(data.voteCount).toString() : '0';

    this.reply_count = data.replyCount || 0;
    this.is_liked = !!this.action_buttons?.like_button?.is_toggled;
    this.is_disliked = !!this.action_buttons?.dislike_button?.is_toggled;
    this.is_hearted = !!this.action_buttons?.creator_heart?.is_hearted;
    this.is_pinned = !!data.pinnedCommentBadge;
    this.is_member = !!data.sponsorCommentBadge;
  }

  /**
   * Likes the comment.
   */
  async like(): Promise<ApiResponse> {
    if (!this.#actions)
      throw new InnertubeError('An active caller must be provide to perform this operation.');

    const button = this.action_buttons?.like_button;

    if (!button)
      throw new InnertubeError('Like button was not found.', { comment_id: this.comment_id });

    if (button.is_toggled)
      throw new InnertubeError('This comment is already liked', { comment_id: this.comment_id });

    const response = await button.endpoint.call(this.#actions, { parse: false });

    return response;
  }
  /**
   * Dislikes the comment.
   */
  async dislike(): Promise<ApiResponse> {
    if (!this.#actions)
      throw new InnertubeError('An active caller must be provide to perform this operation.');

    const button = this.action_buttons?.dislike_button;

    if (!button)
      throw new InnertubeError('Dislike button was not found.', { comment_id: this.comment_id });

    if (button.is_toggled)
      throw new InnertubeError('This comment is already disliked', { comment_id: this.comment_id });

    const response = await button.endpoint.call(this.#actions, { parse: false });

    return response;
  }

  /**
   * Creates a reply to the comment.
   */
  async reply(text: string): Promise<ApiResponse> {
    if (!this.#actions)
      throw new InnertubeError('An active caller must be provide to perform this operation.');

    if (!this.action_buttons?.reply_button)
      throw new InnertubeError('Cannot reply to another reply. Try mentioning the user instead.', { comment_id: this.comment_id });

    const button = this.action_buttons?.reply_button;

    if (!button.endpoint?.dialog)
      throw new InnertubeError('Reply button endpoint did not have a dialog.');

    const dialog = button.endpoint.dialog as SuperParsedResult<YTNode>;
    const dialog_button = dialog.item().as(CommentReplyDialog).reply_button;

    if (!dialog_button)
      throw new InnertubeError('Reply button was not found in the dialog.', { comment_id: this.comment_id });

    if (!dialog_button.endpoint)
      throw new InnertubeError('Reply button endpoint was not found.', { comment_id: this.comment_id });

    const response = await dialog_button.endpoint.call(this.#actions, { commentText: text });

    return response;
  }

  /**
   * Translates the comment to the given language.
   * @param target_language - Ex; en, ja
   */
  async translate(target_language: string): Promise<{
    content: any;
    success: boolean;
    status_code: number;
    data: any;
  }> {
    if (!this.#actions)
      throw new InnertubeError('An active caller must be provide to perform this operation.');

    // Emojis must be removed otherwise InnerTube throws a 400 status code at us.
    const text = this.content.toString().replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '');

    const payload = {
      text,
      target_language,
      comment_id: this.comment_id
    };

    const action = Proto.encodeCommentActionParams(22, payload);
    const response = await this.#actions.execute('comment/perform_comment_action', { action, client: 'ANDROID' });

    // TODO: maybe add these to Parser#parseResponse?
    const mutations = response.data.frameworkUpdates?.entityBatchUpdate?.mutations;
    const content = mutations?.[0]?.payload?.commentEntityPayload?.translatedContent?.content;

    return { ...response, content };
  }

  setActions(actions: Actions | undefined) {
    this.#actions = actions;
  }
}

export default Comment;