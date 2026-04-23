import { COLORS } from './constants';

export const DARK_COLORS = {
  ...COLORS,
  background: '#121212',
  white: '#1E1E1E',
  text: '#ECECEC',
  gray: '#9E9E9E',
  grayLight: '#2C2C2C',
  grayLighter: '#242424',
  border: '#383838',
  black: '#ECECEC',
};

export const getColors = (theme) => theme === 'dark' ? DARK_COLORS : COLORS;
