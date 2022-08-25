import Proto from '../proto/index';
import Actions from './Actions';
import Constants from '../utils/Constants';
import { throwIfMissing, findNode } from '../utils/Utils';

import Analytics from '../parser/youtube/Analytics';
import TimeWatched from '../parser/youtube/TimeWatched';
import AccountInfo from '../parser/youtube/AccountInfo';

class AccountManager {
  #actions;
  channel;
  settings;

  constructor(actions: Actions) {
    this.#actions = actions;

    this.channel = {
      /**
       * Edits channel name.
       */
      editName: (new_name: string) => this.#actions.channel('channel/edit_name', { new_name }),
      /**
       * Edits channel description.
       *
       */
      editDescription: (new_description: string) => this.#actions.channel('channel/edit_description', { new_description }),
      /**
       * Retrieves basic channel analytics.
       */
      getBasicAnalytics: () => this.getAnalytics()
    };

    this.settings = {
      notifications: {
        /**
         * Notify about activity from the channels you're subscribed to.
         * @param option - ON | OFF
         */
        setSubscriptions: (option: boolean) => this.#setSetting(Constants.ACCOUNT_SETTINGS.SUBSCRIPTIONS, 'SPaccount_notifications', option),
        /**
         * Recommended content notifications.
         * @param option - ON | OFF
         */
        setRecommendedVideos: (option: boolean) => this.#setSetting(Constants.ACCOUNT_SETTINGS.RECOMMENDED_VIDEOS, 'SPaccount_notifications', option),
        /**
         * Notify about activity on your channel.
         * @param option - ON | OFF
         */
        setChannelActivity: (option: boolean) => this.#setSetting(Constants.ACCOUNT_SETTINGS.CHANNEL_ACTIVITY, 'SPaccount_notifications', option),
        /**
         * Notify about replies to your comments.
         * @param option - ON | OFF
         */
        setCommentReplies: (option: boolean) => this.#setSetting(Constants.ACCOUNT_SETTINGS.COMMENT_REPLIES, 'SPaccount_notifications', option),
        /**
         * Notify when others mention your channel.
         * @param option - ON | OFF
         */
        setMentions: (option: boolean) => this.#setSetting(Constants.ACCOUNT_SETTINGS.USER_MENTION, 'SPaccount_notifications', option),
        /**
         * Notify when others share your content on their channels.
         * @param option - ON | OFF
         */
        setSharedContent: (option: boolean) => this.#setSetting(Constants.ACCOUNT_SETTINGS.SHARED_CONTENT, 'SPaccount_notifications', option)
      },
      privacy: {
        /**
         * If set to true, your subscriptions won't be visible to others.
         * @param option - ON | OFF
         */
        setSubscriptionsPrivate: (option: boolean) => this.#setSetting(Constants.ACCOUNT_SETTINGS.SUBSCRIPTIONS_PRIVACY, 'SPaccount_privacy', option),
        /**
         * If set to true, saved playlists won't appear on your channel.
         * @param option - ON | OFF
         */
        setSavedPlaylistsPrivate: (option: boolean) => this.#setSetting(Constants.ACCOUNT_SETTINGS.PLAYLISTS_PRIVACY, 'SPaccount_privacy', option)
      }
    };
  }

  /**
   * Internal method to perform changes on an account's settings.
   */
  async #setSetting(setting_id: string, type: string, new_value: boolean) {
    throwIfMissing({ setting_id, type, new_value });

    const response = await this.#actions.browse(type);

    const contents = (() => {
      switch (type.trim()) {
        case 'SPaccount_notifications':
          return findNode(response.data, 'contents', 'Your preferences', 13, false).options;
        case 'SPaccount_privacy':
          return findNode(response.data, 'contents', 'settingsSwitchRenderer', 13, false).options;
        default:
          // This is just for maximum compatibility, this is most definitely a bad way to handle this
          throw new TypeError('undefined is not a function');
      }
    })();

    const option = contents.find((option: any) => option.settingsSwitchRenderer.enableServiceEndpoint.setSettingEndpoint.settingItemIdForClient == setting_id);
    const setting_item_id = option.settingsSwitchRenderer.enableServiceEndpoint.setSettingEndpoint.settingItemId;

    const set_setting = await this.#actions.account('account/set_setting', {
      new_value: type == 'SPaccount_privacy' ? !new_value : new_value,
      setting_item_id
    });

    return set_setting;
  }

  /**
   * Retrieves channel info.
   */
  async getInfo() {
    const response = await this.#actions.execute('/account/accounts_list', { client: 'ANDROID' });
    return new AccountInfo(response);
  }

  /**
   * Retrieves time watched statistics.
   */
  async getTimeWatched() {
    const response = await this.#actions.execute('/browse', {
      browseId: 'SPtime_watched',
      client: 'ANDROID'
    });

    return new TimeWatched(response);
  }

  /**
   * Retrieves basic channel analytics.
   */
  async getAnalytics() {
    const info = await this.getInfo();

    const params = Proto.encodeChannelAnalyticsParams(info.footers?.endpoint.payload.browseId);
    const response = await this.#actions.browse('FEanalytics_screen', { params, client: 'ANDROID' });

    return new Analytics(response);
  }
}

export default AccountManager;