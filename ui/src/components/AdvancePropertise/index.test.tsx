import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AdvancePropertise from './index';

const mockGetContentTypes = vi.hoisted(() => vi.fn());
const mockGetExistingTaxonomies = vi.hoisted(() => vi.fn());
vi.mock('../../services/api/migration.service', () => ({
  getContentTypes: mockGetContentTypes,
  getExistingTaxonomies: mockGetExistingTaxonomies
}));

/**
 * Regression: a previously-saved "Embed Object(s)" selection is persisted as a plain array
 * of content type uids. ctValue (the Select's selected value) used to be initialized straight
 * from those uids with the uid doubling as its own label — so the dropdown's OPTION list
 * showed real content type names, but the SELECTED chips showed raw uids like
 * "blt1234567890abcdef" until the user picked something fresh in that session.
 */
describe('AdvancePropertise — embed objects show real names, not uids', () => {
  const baseProps = {
    fieldtype: 'JSON Rich Text Editor',
    value: {
      embedObjects: ['blt_hero_banner_uid', 'blt_product_info_uid']
    },
    rowId: 'row-1',
    updateFieldSettings: vi.fn(),
    isLocalised: false,
    closeModal: vi.fn(),
    data: {},
    projectId: 'proj-1'
  } as any;

  it('re-maps saved embed-object uids to their real content type titles once content types load', async () => {
    mockGetContentTypes.mockResolvedValue({
      data: {
        contentTypes: [
          { contentstackUid: 'blt_hero_banner_uid', contentstackTitle: 'Hero Banner', type: 'content_type' },
          { contentstackUid: 'blt_product_info_uid', contentstackTitle: 'Product Info', type: 'content_type' }
        ]
      }
    });

    render(<AdvancePropertise {...baseProps} />);

    await waitFor(() => expect(screen.getByText('Hero Banner')).toBeInTheDocument());
    expect(screen.getByText('Product Info')).toBeInTheDocument();

    // The raw uids must not be shown as chip labels anywhere.
    expect(screen.queryByText('blt_hero_banner_uid')).not.toBeInTheDocument();
    expect(screen.queryByText('blt_product_info_uid')).not.toBeInTheDocument();
  });
});

/**
 * Regression: title is guaranteed mandatory by ensureMandatoryFields on extraction, but
 * nothing stopped a user from opening Advanced Properties on the title row and unchecking
 * "Mandatory" here, and contentMapper.service.ts's save path persisted whatever was toggled
 * with no re-enforcement. Locking the toggle for contentstackFieldUid === 'title' (mirroring
 * the existing Modular Blocks/Block lock) closes that off at the source.
 */
describe('AdvancePropertise — Mandatory toggle locked for title', () => {
  const baseProps = {
    fieldtype: 'Single Line Textbox',
    value: { mandatory: true },
    rowId: 'row-1',
    updateFieldSettings: vi.fn(),
    isLocalised: false,
    closeModal: vi.fn(),
    projectId: 'proj-1'
  } as any;

  it('disables the Mandatory toggle for the title field', () => {
    render(<AdvancePropertise {...baseProps} data={{ contentstackFieldUid: 'title' }} />);
    const toggle = screen.getByText('Mandatory').closest('.ToggleWrap')?.querySelector('input');
    expect(toggle).toBeDisabled();
  });

  it('leaves the Mandatory toggle enabled for a non-title single-line field', () => {
    render(<AdvancePropertise {...baseProps} data={{ contentstackFieldUid: 'summary' }} />);
    const toggle = screen.getByText('Mandatory').closest('.ToggleWrap')?.querySelector('input');
    expect(toggle).not.toBeDisabled();
  });
});
