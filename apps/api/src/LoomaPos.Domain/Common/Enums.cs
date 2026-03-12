namespace LoomaPos.Domain.Common;

public enum SaleStatus
{
    Completed = 1,
    Voided = 2,
    Refunded = 3
}

public enum PaymentMethod
{
    Cash = 1,
    Card = 2
}

public enum ContactType
{
    Customer = 1,
    Supplier = 2
}

public enum CashTransactionType
{
    In = 1,
    Out = 2
}
