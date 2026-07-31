const { rankReviewers, calculateLoadScore } = require('../src/utils/balancer');

describe('Assignment Algorithm', () => {
  const teamMembers = [
    { id: 1, username: 'alice', active: true, open_review_count: 3, avg_turnaround_hours: 4 },
    { id: 2, username: 'bob', active: true, open_review_count: 1, avg_turnaround_hours: 8 },
    { id: 3, username: 'charlie', active: true, open_review_count: 0, avg_turnaround_hours: 2 },
    { id: 4, username: 'dana', active: false, open_review_count: 0, avg_turnaround_hours: 1 }, // PTO
    { id: 5, username: 'eve', active: true, open_review_count: 5, avg_turnaround_hours: 3 },
  ];

  test('calculates load score correctly', () => {
    expect(calculateLoadScore(3, 4)).toBe(10); // 3*2 + 4
    expect(calculateLoadScore(0, 2.5)).toBe(2.5);
  });

  test('picks the reviewer with lowest load score', () => {
    const ranked = rankReviewers(teamMembers, 99); // author not in team
    expect(ranked[0].username).toBe('charlie'); // 0*2 + 2 = 2
    expect(ranked[0].load_score).toBe(2);
  });

  test('excludes the PR author from candidates', () => {
    const ranked = rankReviewers(teamMembers, 3); // charlie is the author
    expect(ranked.find(r => r.username === 'charlie')).toBeUndefined();
    expect(ranked[0].username).toBe('bob'); // 1*2 + 8 = 10
  });

  test('excludes inactive (PTO) members', () => {
    const ranked = rankReviewers(teamMembers, 99);
    expect(ranked.find(r => r.username === 'dana')).toBeUndefined();
  });

  test('ranks correctly by load score formula', () => {
    const ranked = rankReviewers(teamMembers, 99);
    // charlie: 0*2+2=2, bob: 1*2+8=10, alice: 3*2+4=10, eve: 5*2+3=13
    expect(ranked.map(r => r.username)).toEqual(['charlie', 'bob', 'alice', 'eve']);
  });

  test('handles empty team gracefully', () => {
    const ranked = rankReviewers([], 99);
    expect(ranked).toEqual([]);
  });

  test('handles all members being the author', () => {
    const singleMember = [{ id: 1, username: 'solo', active: true, open_review_count: 0, avg_turnaround_hours: 0 }];
    const ranked = rankReviewers(singleMember, 1);
    expect(ranked).toEqual([]);
  });

  test('handles tie-breaking (stable sort order)', () => {
    const ranked = rankReviewers(teamMembers, 99);
    // bob and alice both have load_score=10, order should be stable
    const tiedReviewers = ranked.filter(r => r.load_score === 10);
    expect(tiedReviewers.length).toBe(2);
  });
});
