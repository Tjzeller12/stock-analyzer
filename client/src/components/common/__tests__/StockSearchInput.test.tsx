import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import StockSearchInput from '../StockSearchInput';

const mockAuthGet = vi.fn();

vi.mock('../../../utils/api', () => ({
    authGet: (...args: unknown[]) => mockAuthGet(...args),
}));

vi.mock('../../../constants/api', () => ({
    DATA_ENDPOINTS: { SEARCH: 'http://localhost/data/search' },
}));

const MOCK_RESULTS = [
    { symbol: 'AAPL', name: 'Apple Inc',  type: 'Equity', exchange: 'United States' },
    { symbol: 'TSLA', name: 'Tesla Inc',  type: 'Equity', exchange: 'United States' },
];

describe('StockSearchInput', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockAuthGet.mockResolvedValue(MOCK_RESULTS);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('renders the search input with correct placeholder', () => {
        render(<StockSearchInput onStockSelect={vi.fn()} />);
        expect(screen.getByPlaceholderText('Search for a stock')).toBeInTheDocument();
    });

    it('does not call the API when query is shorter than 2 characters', async () => {
        render(<StockSearchInput onStockSelect={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText('Search for a stock'), { target: { value: 'a' } });
        await act(async () => { vi.advanceTimersByTime(400); });
        expect(mockAuthGet).not.toHaveBeenCalled();
    });

    it('calls authGet with the search query after the 300ms debounce', async () => {
        render(<StockSearchInput onStockSelect={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText('Search for a stock'), { target: { value: 'ap' } });
        await act(async () => { vi.advanceTimersByTime(300); });
        expect(mockAuthGet).toHaveBeenCalledWith('http://localhost/data/search?q=ap');
    });

    it('does not fire early if typing before debounce expires', async () => {
        render(<StockSearchInput onStockSelect={vi.fn()} />);
        const input = screen.getByPlaceholderText('Search for a stock');
        fireEvent.change(input, { target: { value: 'ap' } });
        await act(async () => { vi.advanceTimersByTime(100); });
        fireEvent.change(input, { target: { value: 'app' } });
        await act(async () => { vi.advanceTimersByTime(100); });
        // Only 200ms total elapsed since last keypress — should not have fired yet
        expect(mockAuthGet).not.toHaveBeenCalled();
    });

    it('shows results in the dropdown after API responds', async () => {
        render(<StockSearchInput onStockSelect={vi.fn()} />);
        fireEvent.change(screen.getByPlaceholderText('Search for a stock'), { target: { value: 'ap' } });
        await act(async () => { vi.advanceTimersByTime(300); });
        await waitFor(() => {
            expect(screen.getByText('Apple Inc')).toBeInTheDocument();
            expect(screen.getByText('AAPL')).toBeInTheDocument();
            expect(screen.getByText('Tesla Inc')).toBeInTheDocument();
        });
    });

    it('clicking the + button calls onStockSelect with the correct symbol', async () => {
        const onStockSelect = vi.fn();
        render(<StockSearchInput onStockSelect={onStockSelect} />);
        fireEvent.change(screen.getByPlaceholderText('Search for a stock'), { target: { value: 'ap' } });
        await act(async () => { vi.advanceTimersByTime(300); });
        await waitFor(() => screen.getByTitle('Add AAPL'));

        fireEvent.mouseDown(screen.getByTitle('Add AAPL'));
        expect(onStockSelect).toHaveBeenCalledWith('AAPL');
    });

    it('clears the query and results after a stock is selected', async () => {
        render(<StockSearchInput onStockSelect={vi.fn()} />);
        const input = screen.getByPlaceholderText('Search for a stock');
        fireEvent.change(input, { target: { value: 'ap' } });
        await act(async () => { vi.advanceTimersByTime(300); });
        await waitFor(() => screen.getByTitle('Add AAPL'));

        fireEvent.mouseDown(screen.getByTitle('Add AAPL'));
        expect(input).toHaveValue('');
        await waitFor(() => expect(screen.queryByText('Apple Inc')).not.toBeInTheDocument());
    });
});
