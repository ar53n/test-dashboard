import styled from 'styled-components'
import { media } from '@/shared/ui/media.ts'

export const Page = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.space(6)} ${theme.space(6)} ${theme.space(10)}`};

  @media ${media.narrow} {
    padding: ${({ theme }) => `${theme.space(4)} ${theme.space(3)}`};
  }

  /* Страница занимает ровно экран, а панели прокручиваются независимо: шапка с переключателем вида всегда на месте. */
  @media ${media.fitScreen} {
    display: flex;
    flex-direction: column;
    height: 100vh;
    /* На телефонах 100vh больше видимой области, пока показана адресная строка. */
    height: 100dvh;
  }

  @media ${media.split} {
    padding-bottom: ${({ theme }) => theme.space(6)};
  }
`

export const Header = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => `${theme.space(2)} ${theme.space(4)}`};
  margin-bottom: ${({ theme }) => theme.space(5)};

  @media ${media.narrow} {
    margin-bottom: ${({ theme }) => theme.space(3)};
  }

  /* Если прокручивается вся страница, шапка с переключателем вида остаётся наверху. */
  @media ${media.scrollPage} {
    position: sticky;
    top: 0;
    z-index: 2;
    margin-top: ${({ theme }) => `-${theme.space(2)}`};
    padding-block: ${({ theme }) => theme.space(2)};
    background: ${({ theme }) => theme.color.background};
  }
`

export const TitleGroup = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.space(0.5)};
`

export const HeaderControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.space(3)};

  /* Индикатор и переключатель в одну строку, пока помещаются: панели остаётся больше высоты. */
  @media ${media.narrow} {
    flex: 1 0 100%;
    justify-content: space-between;
    gap: ${({ theme }) => theme.space(2)};
  }
`

export const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
`

export const Summary = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.color.textMuted};
  font-variant-numeric: tabular-nums;
`

export const Main = styled.main`
  display: grid;
  gap: ${({ theme }) => theme.space(4)};

  @media ${media.fitScreen} {
    flex: 1;
    min-height: 0;
    /* Без явной высоты строки grid растягивается по содержимому и панели не прокручиваются. */
    grid-template-rows: minmax(0, 1fr);
  }

  @media ${media.split} {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  }
`

export const Panel = styled.section`
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${({ theme }) => theme.color.surface};
  border: 1px solid ${({ theme }) => theme.color.border};
  border-radius: ${({ theme }) => theme.radius.md};
  box-shadow: ${({ theme }) => theme.shadow.panel};
  overflow: hidden;
`

export const PanelHeader = styled.h2`
  margin: 0;
  padding: ${({ theme }) => `${theme.space(3)} ${theme.space(4)}`};
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
  font-size: ${({ theme }) => theme.font.size.md};
`
