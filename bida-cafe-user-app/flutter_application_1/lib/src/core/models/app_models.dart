import '../config/app_config.dart';

class AppUser {
  const AppUser({
    required this.userId,
    required this.phone,
    required this.fullName,
    required this.walletBalance,
    required this.totalDeposited,
    required this.rankId,
    required this.avatarUrl,
  });

  final int userId;
  final String phone;
  final String fullName;
  final double walletBalance;
  final double totalDeposited;
  final int? rankId;
  final String? avatarUrl;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    final name = (json['full_name'] ?? '').toString().trim();
    return AppUser(
      userId: toInt(json['user_id']),
      phone: (json['phone'] ?? '').toString(),
      fullName: name.isEmpty ? 'Thanh vien' : name,
      walletBalance: toDouble(json['wallet_balance']),
      totalDeposited: toDouble(json['total_deposited']),
      rankId: json['rank_id'] == null ? null : toInt(json['rank_id']),
      avatarUrl: json['avatar_url']?.toString(),
    );
  }
}

class UserSession {
  const UserSession({
    required this.token,
    required this.refreshToken,
    required this.user,
  });

  final String token;
  final String refreshToken;
  final AppUser user;
}

class ActiveSessionData {
  const ActiveSessionData({
    required this.tableId,
    required this.tableNumber,
    required this.minutes,
    required this.billiardSubtotal,
    required this.billiardTotal,
    required this.discountPct,
    required this.discountAmount,
    required this.cafeTotal,
    required this.estimatedTotal,
    required this.cafeItems,
  });

  final int tableId;
  final int tableNumber;
  final int minutes;
  final double billiardSubtotal;
  final double billiardTotal;
  final double discountPct;
  final double discountAmount;
  final double cafeTotal;
  final double estimatedTotal;
  final List<dynamic> cafeItems;

  factory ActiveSessionData.fromJson(Map<String, dynamic> json) {
    return ActiveSessionData(
      tableId: toInt(json['table_id'] ?? json['tableId']),
      tableNumber: toInt(json['table_number'] ?? json['tableNumber']),
      minutes: toInt(json['minutes']),
      billiardSubtotal: toDouble(json['billiard_subtotal'] ?? json['billiardSubtotal'] ?? json['subtotal_billiard']),
      billiardTotal: toDouble(json['billiard_total'] ?? json['billiardTotal'] ?? json['total_billiard']),
      discountPct: toDouble(json['discount_pct'] ?? json['discountPct']),
      discountAmount: toDouble(json['discount_amount'] ?? json['discountAmount'] ?? json['billiard_discount']),
      cafeTotal: toDouble(json['cafe_total'] ?? json['cafeTotal']),
      estimatedTotal: toDouble(json['estimated_total'] ?? json['estimatedTotal'] ?? json['grand_total'] ?? json['total_amount']),
      cafeItems: json['cafe_items'] as List<dynamic>? ?? json['cafeItems'] as List<dynamic>? ?? [],
    );
  }
}

class TableInfo {
  const TableInfo({
    required this.tableId,
    required this.tableNumber,
    required this.status,
    required this.isVip,
  });

  final int tableId;
  final int tableNumber;
  final String status;
  final bool isVip;

  bool get isAvailable => status.toUpperCase() == 'AVAILABLE';

  factory TableInfo.fromJson(Map<String, dynamic> json) {
    return TableInfo(
      tableId: toInt(json['table_id']),
      tableNumber: toInt(json['table_number']),
      status: (json['status'] ?? '').toString(),
      isVip: json['is_vip'] == true,
    );
  }
}

class ProductInfo {
  const ProductInfo({
    required this.productId,
    required this.productName,
    required this.category,
    required this.price,
    required this.imageUrl,
    required this.stockQuantity,
  });

  final int productId;
  final String productName;
  final String category;
  final double price;
  final String? imageUrl;
  final double stockQuantity;

  factory ProductInfo.fromJson(Map<String, dynamic> json) {
    return ProductInfo(
      productId: toInt(json['product_id']),
      productName: (json['product_name'] ?? '').toString(),
      category: (json['category'] ?? 'Khac').toString(),
      price: toDouble(json['price']),
      imageUrl: json['image_url']?.toString(),
      stockQuantity: toDouble(json['stock_quantity']),
    );
  }
}

class MembershipData {
  const MembershipData({
    required this.totalDeposited,
    required this.currentRankName,
    required this.discountCafePct,
    required this.discountBilliardPct,
    required this.nextRankName,
    required this.nextThreshold,
  });

  final double totalDeposited;
  final String currentRankName;
  final double discountCafePct;
  final double discountBilliardPct;
  final String? nextRankName;
  final double? nextThreshold;

  factory MembershipData.fromJson(Map<String, dynamic> json) {
    final currentRank = json['current_rank'] as Map<String, dynamic>? ?? {};
    final nextRank = json['next_rank'] as Map<String, dynamic>?;
    return MembershipData(
      totalDeposited: toDouble(json['total_deposited']),
      currentRankName: (currentRank['rank_name'] ?? 'Standard').toString(),
      discountCafePct: toDouble(currentRank['discount_cafe_pct']),
      discountBilliardPct: toDouble(currentRank['discount_billiard_pct']),
      nextRankName: nextRank?['rank_name']?.toString(),
      nextThreshold: nextRank == null
          ? null
          : toDouble(nextRank['min_deposit_threshold']),
    );
  }
}

class DepositRecord {
  const DepositRecord({
    required this.depositId,
    required this.amount,
    required this.paymentMethod,
    required this.createdAt,
  });

  final int depositId;
  final double amount;
  final String paymentMethod;
  final DateTime? createdAt;

  factory DepositRecord.fromJson(Map<String, dynamic> json) {
    return DepositRecord(
      depositId: toInt(json['deposit_id']),
      amount: toDouble(json['amount']),
      paymentMethod: (json['payment_method'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()),
    );
  }
}

class WalletData {
  const WalletData({
    required this.walletBalance,
    required this.totalDeposited,
    required this.recentDeposits,
  });

  final double walletBalance;
  final double totalDeposited;
  final List<DepositRecord> recentDeposits;

  factory WalletData.fromJson(Map<String, dynamic> json) {
    return WalletData(
      walletBalance: toDouble(json['wallet_balance']),
      totalDeposited: toDouble(json['total_deposited']),
      recentDeposits: (json['recent_deposits'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(DepositRecord.fromJson)
          .toList(),
    );
  }
}

class HomeBundle {
  const HomeBundle({
    required this.user,
    required this.activeSession,
    required this.tables,
  });

  final AppUser user;
  final ActiveSessionData? activeSession;
  final List<TableInfo> tables;
}

class BookingInfo {
  const BookingInfo({
    required this.bookingId,
    required this.tableId,
    required this.tableNumber,
    required this.status,
    required this.bookingStart,
    required this.bookingEnd,
    required this.notes,
  });

  final int bookingId;
  final int tableId;
  final int tableNumber;
  final String status;
  final DateTime? bookingStart;
  final DateTime? bookingEnd;
  final String? notes;

  bool get canCancel {
    final value = status.toUpperCase();
    return value == 'PENDING' || value == 'RESERVED';
  }

  factory BookingInfo.fromJson(Map<String, dynamic> json) {
    return BookingInfo(
      bookingId: toInt(json['booking_id']),
      tableId: toInt(json['table_id']),
      tableNumber: toInt(json['table_number']),
      status: (json['status'] ?? '').toString(),
      bookingStart: DateTime.tryParse((json['booking_start'] ?? '').toString()),
      bookingEnd: DateTime.tryParse((json['booking_end'] ?? '').toString()),
      notes: json['notes']?.toString(),
    );
  }
}

class OrderHistoryItem {
  const OrderHistoryItem({
    required this.orderId,
    required this.totalAmount,
    required this.orderType,
    required this.status,
    required this.createdAt,
  });

  final int orderId;
  final double totalAmount;
  final String orderType;
  final String status;
  final DateTime? createdAt;

  factory OrderHistoryItem.fromJson(Map<String, dynamic> json) {
    return OrderHistoryItem(
      orderId: toInt(json['order_id']),
      totalAmount: toDouble(json['total_amount']),
      orderType: (json['order_type'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()),
    );
  }
}

class OrderDetailItem {
  const OrderDetailItem({
    required this.detailId,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  final int detailId;
  final int productId;
  final String productName;
  final double quantity;
  final double unitPrice;
  final double lineTotal;

  factory OrderDetailItem.fromJson(Map<String, dynamic> json) {
    return OrderDetailItem(
      detailId: toInt(json['detail_id']),
      productId: toInt(json['product_id']),
      productName: (json['product_name'] ?? '').toString(),
      quantity: toDouble(json['quantity']),
      unitPrice: toDouble(json['unit_price']),
      lineTotal: toDouble(json['line_total']),
    );
  }
}

class OrderDetail {
  const OrderDetail({
    required this.orderId,
    required this.totalAmount,
    required this.orderType,
    required this.status,
    required this.createdAt,
    required this.items,
  });

  final int orderId;
  final double totalAmount;
  final String orderType;
  final String status;
  final DateTime? createdAt;
  final List<OrderDetailItem> items;

  factory OrderDetail.fromJson(Map<String, dynamic> json) {
    return OrderDetail(
      orderId: toInt(json['order_id']),
      totalAmount: toDouble(json['total_amount']),
      orderType: (json['order_type'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      createdAt: DateTime.tryParse((json['created_at'] ?? '').toString()),
      items: (json['items'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(OrderDetailItem.fromJson)
          .toList(),
    );
  }
}
