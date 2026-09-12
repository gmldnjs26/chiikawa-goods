import { formatCount } from './consts';

describe('formatCount', () => {
  it('N点', () => {
    expect(formatCount(51)).toBe('51点');
  });
});
