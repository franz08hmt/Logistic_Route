import { describe, expect, it } from 'vitest';

import { shouldRequestAddressSuggestions } from './address-search-state';

describe('address autocomplete search state', () => {
  it('searches while the user is typing even when the parent form mirrors the text', () => {
    expect(shouldRequestAddressSuggestions({
      query: 'Bệnh viện Đa khoa',
      selectedAddress: null,
    })).toBe(true);
  });

  it('does not immediately search again after selecting a suggestion', () => {
    expect(shouldRequestAddressSuggestions({
      query: 'Bệnh viện Đa khoa Quốc tế Vinmec Central Park',
      selectedAddress: 'Bệnh viện Đa khoa Quốc tế Vinmec Central Park',
    })).toBe(false);
  });

  it('waits until at least three non-whitespace characters are entered', () => {
    expect(shouldRequestAddressSuggestions({
      query: '  ab ',
      selectedAddress: null,
    })).toBe(false);
  });
});
