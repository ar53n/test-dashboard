import styled from 'styled-components'

/** Прокручиваемая область панели, растягивается на оставшуюся высоту flex-колонки. */
export const ScrollArea = styled.div`
  /* Контейнер для скрытых подписей (position: absolute), иначе они выходят за overflow и растягивают страницу. */
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
`
