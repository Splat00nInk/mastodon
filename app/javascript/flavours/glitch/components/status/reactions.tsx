import { useCallback, useMemo } from 'react';
import type { FC, HTMLAttributes } from 'react';

import { FormattedMessage } from 'react-intl';

import classNames from 'classnames';

import type { AnimatedProps } from '@react-spring/web';
import { animated, useTransition } from '@react-spring/web';

import {
  addReaction,
  removeReaction,
} from '@/flavours/glitch/actions/interactions';
import type { ApiStatusReactionJSON } from '@/flavours/glitch/api_types/reaction';
import { AnimatedNumber } from '@/flavours/glitch/components/animated_number';
import { Emoji } from '@/flavours/glitch/components/emoji';
import {
  AnimateEmojiProvider,
  CustomEmojiProvider,
} from '@/flavours/glitch/components/emoji/context';
import type { OnEmojiPick } from '@/flavours/glitch/components/emoji/picker';
import {
  EmojiPickerButton,
  emojiToString,
} from '@/flavours/glitch/components/emoji/picker';
import { isUnicodeEmoji } from '@/flavours/glitch/features/emoji/utils';
import { useCurrentAccountId } from '@/flavours/glitch/hooks/useAccountId';
import {
  maxReactions,
  reduceMotion,
  visibleReactions as visibleReactionsSetting,
} from '@/flavours/glitch/initial_state';
import { useAppDispatch } from '@/flavours/glitch/store';

import { StatusReactIcon } from './icons';
import classes from './reactions.module.scss';

const EMPTY_REACTIONS: ApiStatusReactionJSON[] = [];

/**
 * Returns whether the current user may add another reaction to a post.
 */
export function useCanReact(reactions: ApiStatusReactionJSON[] | undefined) {
  const currentAccountId = useCurrentAccountId();
  const ownReactions = (reactions ?? EMPTY_REACTIONS).filter(
    (reaction) => (reaction.count ?? 0) > 0 && reaction.me,
  ).length;

  return !!currentAccountId && ownReactions < maxReactions;
}

/**
 * Returns a picker callback that adds the selected emoji as a reaction.
 */
export function useReactionPickHandler(statusId: string): OnEmojiPick {
  const dispatch = useAppDispatch();

  return useCallback(
    (emoji) => {
      const name = emojiToString(emoji).replaceAll(':', '');
      const url = 'imageUrl' in emoji ? emoji.imageUrl : undefined;
      dispatch(addReaction(statusId, name, url));
    },
    [dispatch, statusId],
  );
}

/**
 * The "add reaction" button shown in a post's action bar.
 */
export const StatusReactButton: FC<{
  statusId: string;
  reactions: ApiStatusReactionJSON[] | undefined;
  className?: string;
}> = ({ statusId, reactions, className }) => {
  const canReact = useCanReact(reactions);
  const handlePick = useReactionPickHandler(statusId);

  return (
    <EmojiPickerButton
      onPick={handlePick}
      disabled={!canReact}
      variant='ghost'
      icon={StatusReactIcon}
      placement='bottom-start'
      className={className}
      label={<FormattedMessage id='status.react' defaultMessage='React' />}
    />
  );
};

export const StatusReactions: FC<{
  statusId: string;
  reactions: ApiStatusReactionJSON[] | undefined;
}> = ({ statusId, reactions = EMPTY_REACTIONS }) => {
  const numVisible = visibleReactionsSetting ?? 6;

  const visibleReactions = useMemo(() => {
    const sorted = reactions
      .filter((reaction) => (reaction.count ?? 0) > 0)
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

    return numVisible >= 0 ? sorted.slice(0, numVisible) : sorted;
  }, [numVisible, reactions]);

  const transitions = useTransition(visibleReactions, {
    from: { scale: 0 },
    initial: { scale: 1 },
    enter: { scale: 1 },
    leave: { scale: 0 },
    immediate: reduceMotion,
    keys: visibleReactions.map((reaction) => reaction.name),
  });

  return (
    <div className={classes.root}>
      {transitions(({ scale }, reaction) => (
        <Reaction
          key={reaction.name}
          reaction={reaction}
          style={{ transform: scale.to((s) => `scale(${s})`) }}
          statusId={statusId}
        />
      ))}
    </div>
  );
};

const Reaction: FC<{
  reaction: ApiStatusReactionJSON;
  statusId: string;
  style: AnimatedProps<HTMLAttributes<HTMLButtonElement>>['style'];
}> = ({ statusId, reaction, style }) => {
  const dispatch = useAppDispatch();
  const signedIn = !!useCurrentAccountId();
  const { name, me, url, static_url } = reaction;

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      // Don't open the post when clicking a reaction in a feed.
      event.stopPropagation();

      if (!signedIn) return;

      if (me) {
        dispatch(removeReaction(statusId, name));
      } else {
        dispatch(addReaction(statusId, name));
      }
    },
    [dispatch, signedIn, statusId, name, me],
  );

  const code = isUnicodeEmoji(name) ? name : `:${name}:`;

  const custom = useMemo(
    () =>
      url
        ? {
            [name]: {
              shortcode: name,
              static_url: static_url ?? url,
              url,
            },
          }
        : undefined,
    [name, url, static_url],
  );

  return (
    <animated.button
      type='button'
      className={classNames(classes.item, me && classes.itemActive)}
      onClick={handleClick}
      disabled={!signedIn}
      aria-pressed={!!me}
      style={style}
    >
      <AnimateEmojiProvider>
        <CustomEmojiProvider emojis={custom}>
          <span className={classes.emoji}>
            <Emoji code={code} />
          </span>
        </CustomEmojiProvider>
      </AnimateEmojiProvider>
      <span className={classes.count}>
        <AnimatedNumber value={reaction.count ?? 0} />
      </span>
    </animated.button>
  );
};
