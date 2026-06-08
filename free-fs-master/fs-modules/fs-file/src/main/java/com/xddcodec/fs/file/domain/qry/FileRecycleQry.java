package com.xddcodec.fs.file.domain.qry;

import com.xddcodec.fs.framework.common.domain.PageQuery;
import lombok.Data;
import lombok.EqualsAndHashCode;

@EqualsAndHashCode(callSuper = true)
@Data
public class FileRecycleQry extends PageQuery {

    private String keyword;
}
