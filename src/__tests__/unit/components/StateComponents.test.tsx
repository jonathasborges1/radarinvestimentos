import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { ErrorState } from '../../../components/ErrorState';
import { EmptyFilterState } from '../../../components/EmptyFilterState';

describe('EmptyState', () => {
  it('renders upload instruction text', () => {
    render(<EmptyState />);
    expect(
      screen.getByText('Carregue um arquivo JSON para começar')
    ).toBeInTheDocument();
  });

  it('renders a heading', () => {
    render(<EmptyState />);
    expect(
      screen.getByText('Nenhum dado carregado')
    ).toBeInTheDocument();
  });
});

describe('LoadingState', () => {
  it('renders loading text', () => {
    render(<LoadingState />);
    expect(screen.getByText('Carregando dados…')).toBeInTheDocument();
  });

  it('has a status role for accessibility', () => {
    render(<LoadingState />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has an accessible label', () => {
    render(<LoadingState />);
    expect(screen.getByLabelText('Carregando')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders the error message', () => {
    render(<ErrorState message="O arquivo selecionado não é um JSON válido." />);
    expect(
      screen.getByText('O arquivo selecionado não é um JSON válido.')
    ).toBeInTheDocument();
  });

  it('renders a heading', () => {
    render(<ErrorState message="Erro genérico" />);
    expect(
      screen.getByText('Erro ao carregar dados')
    ).toBeInTheDocument();
  });

  it('has an alert role for accessibility', () => {
    render(<ErrorState message="Erro" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('EmptyFilterState', () => {
  it('renders the no-results message', () => {
    render(<EmptyFilterState />);
    expect(
      screen.getByText('Nenhum ativo corresponde aos filtros aplicados')
    ).toBeInTheDocument();
  });

  it('renders a heading', () => {
    render(<EmptyFilterState />);
    expect(
      screen.getByText('Nenhum resultado encontrado')
    ).toBeInTheDocument();
  });
});
