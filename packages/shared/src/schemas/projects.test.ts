import { describe, expect, it } from 'vitest';
import { NOT_APPLICABLE, projectInputSchema, withPersonalDefaults } from './projects.js';

describe('withPersonalDefaults (HU-49)', () => {
  it('un personal sin sprint queda con "N/A" en el sprint y sus actividades', () => {
    const input = projectInputSchema.parse({ name: 'Mudanza', scope: 'PERSONAL' });
    expect(withPersonalDefaults(input)).toMatchObject({
      sprint: NOT_APPLICABLE,
      sprintActivities: NOT_APPLICABLE,
      projectManagerId: null,
    });
  });

  it('respeta lo que se escribió', () => {
    const input = projectInputSchema.parse({ name: 'Mudanza', scope: 'PERSONAL', sprint: 'Mes 1' });
    expect(withPersonalDefaults(input).sprint).toBe('Mes 1');
  });

  it('uno de trabajo no cambia; sin ámbito, es de trabajo', () => {
    const input = projectInputSchema.parse({ name: 'Portal' });
    expect(input.scope).toBe('WORK');
    expect(withPersonalDefaults(input)).toEqual(input);
  });
});
