export interface PrintContext {
  billNo: string;
  billDate: string;
  mode?: 'preview' | 'print';
}
