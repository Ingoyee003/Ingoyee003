import React from 'react';

interface Props {
  children: React.ReactNode;
}

/**
 * Wrap the decorative dragon in this so that if it ever throws (canvas
 * unsupported, a bad prop, a future edit...) ONLY the dragon disappears.
 * Without a boundary, one uncaught render error unmounts the whole React tree,
 * which is exactly what a "blank white screen" is.
 */
export class DragonBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn('[CyberDragon] disabled after an error:', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default DragonBoundary;
